import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      runtimeErrorOverlay(),
      tailwindcss(),
      metaImagesPlugin(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer(),
            ),
            import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    // Define environment variables that should be exposed to the client
    define: {
      // Only expose public Supabase variables (not service role key!)
      // Use fallback values for development if not set
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || 'http://127.0.0.1:54321'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'),
      'import.meta.env.VITE_APP_URL': JSON.stringify(env.APP_URL || 'http://localhost:5173'),
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    css: {
      postcss: {
        plugins: [],
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    // Remove server config when in middleware mode - it's handled by Express
    ...(process.env.NODE_ENV === "production" && {
      server: {
        host: "0.0.0.0",
        allowedHosts: true,
        fs: {
          strict: true,
          deny: ["**/.*"],
        },
      },
    }),
  };
});
