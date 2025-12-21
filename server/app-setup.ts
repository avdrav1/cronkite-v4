// Shared application setup for both development and production (Netlify)
import express, { type Request, Response, NextFunction } from "express";
import passport from "passport";
import cors from "cors";
import { registerRoutes } from "./routes";
import { sessionConfig, authMiddleware } from "./auth-middleware";
import { performStartupValidation, logValidationReport } from "./startup-validation";
import { env } from "./env";
import { sanitizeString, safeStringify, validateEnvironmentSecurity } from "./security-utils";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Sanitize message to prevent secret exposure
  const sanitizedMessage = sanitizeString(message);
  console.log(`${formattedTime} [${source}] ${sanitizedMessage}`);
}

export function logError(message: string, error?: Error, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Sanitize message and error to prevent secret exposure
  const sanitizedMessage = sanitizeString(message);
  console.error(`${formattedTime} [${source}] ERROR: ${sanitizedMessage}`);
  
  if (error) {
    // Sanitize error stack trace
    const sanitizedStack = error.stack ? sanitizeString(error.stack) : 'No stack trace available';
    console.error(`${formattedTime} [${source}] Stack trace:`, sanitizedStack);
  }
}

export function logSuccess(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Sanitize message to prevent secret exposure
  const sanitizedMessage = sanitizeString(message);
  console.log(`${formattedTime} [${source}] ✅ ${sanitizedMessage}`);
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
          // Use safe stringify to prevent secret exposure in logs
          logLine += ` :: ${safeStringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  // Perform startup validation
  if (env.NODE_ENV === "production" || env.NETLIFY_FUNCTION) {
    log("🔍 Performing production startup validation...");
    
    // First, validate environment security
    log("🔒 Validating environment security...");
    const securityValidation = validateEnvironmentSecurity();
    
    if (!securityValidation.isSecure) {
      logError("❌ Environment security validation failed");
      securityValidation.errors.forEach(error => logError(`   • ${error}`));
      throw new Error("Environment security validation failed");
    }
    
    if (securityValidation.warnings.length > 0) {
      log("⚠️  Environment security warnings:");
      securityValidation.warnings.forEach(warning => log(`   • ${warning}`));
    }
    
    logSuccess("✅ Environment security validation passed");
    
    // Then perform comprehensive startup validation
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

  // Initialize storage for ALL environments (not just production)
  log("🔍 Initializing storage...");
  const { getStorage } = await import("./storage");
  await getStorage(); // Initialize storage
  logSuccess("✅ Storage initialized");

  // Register API routes
  await registerRoutes(null, app); // No HTTP server needed for Netlify functions

  // Error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logError(`Request failed: ${req.method} ${req.path}`, err);
    
    // Enhanced error handling for production with secret sanitization
    if (env.NODE_ENV === "production") {
      // Don't expose internal errors in production, and sanitize any messages
      const safeMessage = status >= 500 ? "Internal Server Error" : sanitizeString(message);
      res.status(status).json({ 
        message: safeMessage,
        timestamp: new Date().toISOString()
      });
    } else {
      // Sanitized detailed errors for development
      const sanitizedMessage = sanitizeString(message);
      const sanitizedStack = err.stack ? sanitizeString(err.stack) : undefined;
      
      res.status(status).json({ 
        message: sanitizedMessage,
        stack: sanitizedStack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
  });

  logSuccess("Express application setup completed");
}