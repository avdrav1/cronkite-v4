// Load environment variables FIRST
import './env';

import express from "express";
import { serveStatic } from "./static";
import { createServer } from "http";
import { createServer as createNetServer } from "net";
import { setupApp, log, logError, logSuccess } from "./app-setup";
import { 
  initializeAIScheduler, 
  startAIScheduler, 
  stopAIScheduler 
} from "./ai-background-scheduler";
import { webSocketService } from "./websocket-service";

const app = express();
const httpServer = createServer(app);

async function checkPortAvailability(port: number): Promise<{ available: boolean; error?: string }> {
  return new Promise((resolve) => {
    const server = createNetServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve({ available: true });
      });
      server.close();
    });
    
    server.on('error', (error: NodeJS.ErrnoException) => {
      let errorMessage = `Port ${port} is not available`;
      
      if (error.code === 'EADDRINUSE') {
        errorMessage = `Port ${port} is already in use by another process`;
      } else if (error.code === 'EACCES') {
        errorMessage = `Permission denied to bind to port ${port}. Try using a port above 1024`;
      } else if (error.code === 'EADDRNOTAVAIL') {
        errorMessage = `Address not available for port ${port}. Check your network configuration`;
      }
      
      resolve({ available: false, error: errorMessage });
    });
  });
}

async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const result = await checkPortAvailability(port);
    if (result.available) {
      return port;
    }
  }
  return null;
}

(async () => {
  let viteInstance: any = null;
  
  try {
    // Setup the Express application
    await setupApp(app);

    // Setup Vite middleware BEFORE API routes in development
    if (process.env.NODE_ENV !== "production") {
      log("Setting up Vite middleware for development...");
      const { setupVite } = await import("./vite");
      viteInstance = await setupVite(httpServer, app);
      logSuccess("Vite middleware setup complete");

      // Setup HTML fallback route AFTER API routes in development
      log("Setting up HTML fallback route...");
      
      app.use("*", async (req, res, next) => {
        const url = req.originalUrl;

        // Skip HTML fallback for API routes - let them 404 if not found
        if (url.startsWith("/api")) {
          return res.status(404).json({ 
            error: 'API endpoint not found',
            message: `The API endpoint ${url} was not found`
          });
        }

        // Skip HTML fallback for module requests
        if (
          url.includes("/@") || // Vite special paths
          url.includes("/node_modules/") || // Node modules
          url.match(/\.(js|ts|tsx|jsx|css|json|wasm|mjs)(\?.*)?$/) // Module file extensions
        ) {
          return next();
        }

        try {
          const path = await import("path");
          const fs = await import("fs");
          const { nanoid } = await import("nanoid");
          
          const clientTemplate = path.resolve(
            import.meta.dirname,
            "..",
            "client",
            "index.html",
          );

          let template = await fs.promises.readFile(clientTemplate, "utf-8");
          template = template.replace(
            `src="/src/main.tsx"`,
            `src="/src/main.tsx?v=${nanoid()}"`,
          );
          const page = await viteInstance.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(page);
        } catch (e) {
          logError(`Failed to transform HTML for ${url}`, e as Error);
          viteInstance.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
      
      logSuccess("HTML fallback route setup complete");
    }
  } catch (error) {
    logError("Failed to setup development server", error as Error);
    process.exit(1);
  }

  // Setup static file serving for production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  // Start the server
  const port = parseInt(process.env.PORT || "5000", 10);
  
  log(`🔍 Checking port availability for ${port}...`);
  const portCheck = await checkPortAvailability(port);
  
  if (!portCheck.available) {
    logError(`❌ ${portCheck.error}`);
    
    // Try to find an alternative port
    log("🔍 Searching for alternative port...");
    const alternativePort = await findAvailablePort(port + 1, 10);
    
    if (alternativePort) {
      logError(`💡 Alternative port ${alternativePort} is available`);
      logError(`   Run: PORT=${alternativePort} npm run dev`);
    }
    
    process.exit(1);
  }
  
  logSuccess(`✅ Port ${port} is available`);

  // Initialize and start AI background scheduler after storage is ready
  // Requirements: 3.8, 3.9, 7.1, 7.2 - Background processing for embeddings and clustering
  log("🤖 Initializing AI background scheduler...");
  const aiSchedulerInitialized = await initializeAIScheduler();
  if (aiSchedulerInitialized) {
    startAIScheduler();
    logSuccess("✅ AI background scheduler started");
  } else {
    log("⚠️ AI scheduler initialization failed - AI features may be limited");
  }

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      logSuccess(`🚀 Development server started successfully!`);
      logSuccess(`📍 Server Details:`);
      logSuccess(`   • Local:    http://localhost:${port}`);
      logSuccess(`   • Network:  http://0.0.0.0:${port}`);
      
      if (process.env.NODE_ENV !== "production") {
        logSuccess(`🔥 Development Features:`);
        logSuccess(`   • HMR WebSocket: ws://localhost:${port}/vite-hmr`);
        logSuccess(`   • API routes:    http://localhost:${port}/api`);
        logSuccess(`   • Hot reload:    ✅ Enabled`);
      }

      // Initialize WebSocket service after server is listening
      try {
        log("🔌 Initializing WebSocket service...");
        await webSocketService.initialize(httpServer);
        logSuccess(`   • WebSocket:     ws://localhost:${port}/ws`);
      } catch (error) {
        logError("Failed to initialize WebSocket service", error as Error);
        // Don't exit - server can still function without WebSocket
      }
    },
  );

  // Enhanced error handling for server startup
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    logError(`❌ Failed to start server on port ${port}`);
    
    if (error.code === 'EADDRINUSE') {
      logError(`💥 Port ${port} is already in use by another process`);
    } else if (error.code === 'EACCES') {
      logError(`🔒 Permission denied to bind to port ${port}`);
    }
    
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    log('Received SIGTERM, shutting down gracefully...');
    // Stop AI scheduler first
    stopAIScheduler();
    // Shutdown WebSocket service
    await webSocketService.shutdown();
    httpServer.close(() => {
      log('Server closed successfully');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    log('Received SIGINT, shutting down gracefully...');
    // Stop AI scheduler first
    stopAIScheduler();
    // Shutdown WebSocket service
    await webSocketService.shutdown();
    httpServer.close(() => {
      log('Server closed successfully');
      process.exit(0);
    });
  });
})();
