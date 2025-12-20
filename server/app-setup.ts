// Shared application setup for both development and production (Netlify)
import express, { type Request, Response, NextFunction } from "express";
import passport from "passport";
import cors from "cors";
import { registerRoutes } from "./routes";
import { sessionConfig, authMiddleware } from "./auth-middleware";
import { performStartupValidation, logValidationReport } from "./startup-validation";
import { env } from "./env";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function logError(message: string, error?: Error, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.error(`${formattedTime} [${source}] ERROR: ${message}`);
  if (error) {
    console.error(`${formattedTime} [${source}] Stack trace:`, error.stack);
  }
}

export function logSuccess(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ✅ ${message}`);
}

// Setup Express application with all middleware and routes
export async function setupApp(app: express.Application): Promise<void> {
  // Request body parsing
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  // CORS configuration
  if (env.NODE_ENV !== "production") {
    app.use(cors({
      origin: true, // Allow all origins in development
      credentials: true, // Allow cookies to be sent
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
    }));
  } else {
    // Production CORS - more restrictive
    app.use(cors({
      origin: env.APP_URL || false, // Only allow configured app URL
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
    }));
  }

  // Session and authentication middleware
  app.use(sessionConfig);
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(authMiddleware);

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  // Perform startup validation
  if (env.NODE_ENV === "production" || env.NETLIFY_FUNCTION) {
    log("🔍 Performing production startup validation...");
    const validationResult = await performStartupValidation();
    
    if (!validationResult.isValid) {
      logError("❌ Startup validation failed - application cannot start safely");
      logValidationReport(validationResult);
      throw new Error("Startup validation failed");
    }
    
    logSuccess("✅ Production startup validation passed");
    
    if (validationResult.warnings.length > 0) {
      log("⚠️  Startup validation warnings (non-blocking):");
      validationResult.warnings.forEach((warning, index) => {
        log(`   ${index + 1}. ${warning}`);
      });
    }
  }

  // Initialize storage for production
  if (env.NODE_ENV === "production" || env.NETLIFY_FUNCTION) {
    log("🔍 Initializing production storage...");
    const { getStorage } = await import("./storage");
    await getStorage(); // Initialize storage
    logSuccess("✅ Production storage initialized");
  }

  // Register API routes
  await registerRoutes(null, app); // No HTTP server needed for Netlify functions

  // Error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logError(`Request failed: ${req.method} ${req.path}`, err);
    
    // Enhanced error handling for production
    if (env.NODE_ENV === "production") {
      // Don't expose internal errors in production
      res.status(status).json({ 
        message: status >= 500 ? "Internal Server Error" : message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Detailed errors for development
      res.status(status).json({ 
        message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
  });

  logSuccess("Express application setup completed");
}