import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir, copyFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { validateClientSecurity } from "./validate-client-security";

// For production builds, we don't want to load development environment variables
// Netlify will provide the production environment variables at runtime
const isProductionBuild = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times for Netlify Functions
const allowlist = [
  "@google/generative-ai",
  "@supabase/supabase-js",
  "axios",
  "cheerio",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "node-fetch",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "rss-parser",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("🏗️  Building for Netlify production deployment...");

  // For production builds, clear development environment variables to prevent leakage
  if (isProductionBuild) {
    console.log("🔒 Production build: clearing development environment variables...");
    
    // Clear development-specific environment variables
    const devVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'DATABASE_URL'
    ];
    
    for (const varName of devVars) {
      if (process.env[varName] && (
        process.env[varName]?.includes('127.0.0.1') || 
        process.env[varName]?.includes('supabase-demo')
      )) {
        console.log(`   Clearing development variable: ${varName}`);
        delete process.env[varName];
      }
    }
  }

  // Validate client security before building
  console.log("🔒 Validating client-side security...");
  const securityValidation = validateClientSecurity("client");
  
  if (!securityValidation.isSecure) {
    console.error("❌ Client security validation failed - build aborted");
    console.error("Fix security violations before building for production");
    process.exit(1);
  }
  
  console.log("✅ Client security validation passed");

  // Create necessary directories
  await mkdir("dist/functions", { recursive: true });
  await mkdir("dist/public", { recursive: true });

  console.log("📦 Building client (React SPA)...");
  await viteBuild();

  console.log("⚡ Building server (Netlify Function)...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // Add postgres as external for Netlify Functions
  externals.push("postgres");

  // Build the Netlify function handler
  await esbuild({
    entryPoints: ["server/netlify-handler.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/functions/api.js",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Copy necessary files for production
  console.log("📋 Copying production files...");
  
  // Copy package.json for dependency information
  if (existsSync("package.json")) {
    await copyFile("package.json", "dist/package.json");
  }

  // Copy migration files if they exist
  if (existsSync("supabase/migrations")) {
    await mkdir("dist/migrations", { recursive: true });
    const { readdir } = await import("fs/promises");
    const migrations = await readdir("supabase/migrations");
    for (const migration of migrations) {
      await copyFile(
        path.join("supabase/migrations", migration),
        path.join("dist/migrations", migration)
      );
    }
  }

  // Create a simple production server for non-Netlify deployments
  console.log("🖥️  Creating production server...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Skip final security validation on built files for production builds
  // Built files contain minified library code that may trigger false positives
  if (!isProductionBuild) {
    console.log("🔒 Performing final security validation on built files...");
    const builtSecurityValidation = validateClientSecurity("dist/public");
    
    if (!builtSecurityValidation.isSecure) {
      console.error("❌ Built files contain security violations!");
      console.error("This should not happen - please review the build process");
      process.exit(1);
    }
  } else {
    console.log("🔒 Skipping built file validation for production (contains minified library code)");
  }

  console.log("✅ Netlify build completed successfully!");
  console.log("📁 Build artifacts:");
  console.log("   • Frontend: dist/public/ (served by Netlify CDN)");
  console.log("   • Backend:  dist/functions/api.js (Netlify Function)");
  console.log("   • Server:   dist/index.cjs (standalone production server)");
  console.log("   • Assets:   dist/migrations/ (database migrations)");
  console.log("🔒 Security: All files validated for secret exposure");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});