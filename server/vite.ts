import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import path from "path";

const viteLogger = createLogger();

function logVite(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [vite] ${message}`);
}

function logViteError(message: string, error?: Error) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.error(`${formattedTime} [vite] ERROR: ${message}`);
  if (error) {
    console.error(`${formattedTime} [vite] Stack trace:`, error.stack);
  }
}

function logViteSuccess(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [vite] ✅ ${message}`);
}

export async function setupVite(server: Server, app: Express) {
  try {
    logVite("🔧 Configuring Vite server options...");
    
    const port = parseInt(process.env.PORT || "5000", 10);
    const serverOptions = {
      middlewareMode: true,
      hmr: { 
        server, 
        path: "/vite-hmr",
        port: port,
        host: "0.0.0.0"
      },
      allowedHosts: true as const,
      host: "0.0.0.0",
    };

    logVite(`🚀 Creating Vite server with middleware mode on port ${port}...`);
    const vite = await createViteServer({
      configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
      customLogger: {
        ...viteLogger,
        error: (msg, options) => {
          // Enhanced error logging for Vite with specific troubleshooting
          if (msg.includes('WebSocket') || msg.includes('websocket')) {
            logViteError(`❌ WebSocket connection failed: ${msg}`);
            logViteError("💡 HMR WebSocket troubleshooting:");
            logViteError(`   • Verify client connects to: ws://localhost:${port}/vite-hmr`);
            logViteError("   • Check browser console for WebSocket errors");
            logViteError("   • Ensure no proxy is blocking WebSocket connections");
            logViteError("   • Try refreshing the browser page");
            logViteError("   • Verify firewall allows WebSocket connections");
          } else if (msg.includes('MIME') || msg.includes('mime')) {
            logViteError(`❌ MIME type error: ${msg}`);
            logViteError("💡 MIME type troubleshooting:");
            logViteError("   • Check middleware registration order");
            logViteError("   • Ensure Vite middleware handles module requests");
            logViteError("   • Verify file extensions are correct");
            logViteError("   • Clear browser cache and restart server");
          } else if (msg.includes('transform') || msg.includes('parse')) {
            logViteError(`❌ Code transformation error: ${msg}`);
            logViteError("💡 Build troubleshooting:");
            logViteError("   • Check for syntax errors in source files");
            logViteError("   • Verify TypeScript configuration");
            logViteError("   • Clear Vite cache: rm -rf node_modules/.vite");
            logViteError("   • Check import paths and dependencies");
          } else if (msg.includes('404') || msg.includes('not found')) {
            logViteError(`❌ Resource not found: ${msg}`);
            logViteError("💡 File resolution troubleshooting:");
            logViteError("   • Check file paths and imports");
            logViteError("   • Verify file exists in expected location");
            logViteError("   • Check path aliases configuration");
          } else {
            logViteError(`❌ Vite error: ${msg}`);
            logViteError("💡 General Vite troubleshooting:");
            logViteError("   • Check Vite configuration");
            logViteError("   • Verify all dependencies are installed");
            logViteError("   • Try clearing cache and restarting");
          }
          viteLogger.error(msg, options);
        },
        warn: (msg, options) => {
          if (msg.includes('WebSocket') || msg.includes('websocket')) {
            logVite(`⚠️  WebSocket warning: ${msg}`);
            logVite("💡 This may affect hot module replacement functionality");
          } else if (msg.includes('hmr') || msg.includes('HMR')) {
            logVite(`⚠️  HMR warning: ${msg}`);
          } else {
            viteLogger.warn(msg, options);
          }
        },
        info: (msg, options) => {
          if (msg.includes('ready')) {
            logViteSuccess(`✅ Vite development server ready`);
          } else if (msg.includes('hmr') || msg.includes('HMR')) {
            logVite(`🔄 HMR: ${msg}`);
          } else if (msg.includes('update')) {
            logVite(`📝 File update: ${msg}`);
          } else {
            viteLogger.info(msg, options);
          }
        }
      },
      server: serverOptions,
      appType: "custom",
    });

    logVite("🔌 Registering Vite middleware...");
    // Register Vite middleware - it handles module requests with proper MIME types
    app.use(vite.middlewares);

    logViteSuccess("✅ Vite middleware setup completed successfully");
    logViteSuccess(`🔗 HMR WebSocket configured at: ws://localhost:${port}/vite-hmr`);
    
    // Enhanced WebSocket connection monitoring with detailed logging
    let wsConnectionCount = 0;
    let wsConnectionAttempts = 0;
    
    server.on('upgrade', (request, socket, head) => {
      if (request.url?.includes('/vite-hmr')) {
        wsConnectionAttempts++;
        const origin = request.headers.origin || 'unknown origin';
        const userAgent = request.headers['user-agent'] || 'unknown client';
        
        logVite(`🔌 HMR WebSocket connection attempt #${wsConnectionAttempts}`);
        logVite(`   • Origin: ${origin}`);
        logVite(`   • Client: ${userAgent.substring(0, 50)}${userAgent.length > 50 ? '...' : ''}`);
        logVite(`   • URL: ${request.url}`);
        
        // Track successful connections
        socket.on('connect', () => {
          wsConnectionCount++;
          logViteSuccess(`✅ HMR WebSocket connected (${wsConnectionCount} active)`);
        });
        
        socket.on('close', () => {
          wsConnectionCount = Math.max(0, wsConnectionCount - 1);
          logVite(`🔌 HMR WebSocket disconnected (${wsConnectionCount} active)`);
        });
        
        socket.on('error', (error) => {
          logViteError(`❌ HMR WebSocket error: ${error.message}`, error);
          logViteError("💡 WebSocket error troubleshooting:");
          logViteError("   • Check if client and server ports match");
          logViteError("   • Verify WebSocket path is correct (/vite-hmr)");
          logViteError("   • Check for network connectivity issues");
          logViteError("   • Try refreshing the browser");
        });
      }
    });

    // Monitor for WebSocket server errors with enhanced diagnostics
    server.on('error', (error) => {
      if (error.message.includes('WebSocket') || error.message.includes('upgrade')) {
        logViteError(`❌ WebSocket server error: ${error.message}`, error);
        logViteError("💡 This may affect HMR functionality:");
        logViteError("   • Hot module replacement may not work");
        logViteError("   • Manual browser refresh may be needed");
        logViteError("   • Check server configuration and restart if needed");
      }
    });
    
    // Periodic WebSocket health check in development
    if (process.env.NODE_ENV !== "production") {
      setInterval(() => {
        if (wsConnectionAttempts > 0 && wsConnectionCount === 0) {
          logVite(`⚠️  WebSocket Health Check: ${wsConnectionAttempts} attempts, 0 active connections`);
          logVite("💡 If you're experiencing HMR issues:");
          logVite("   • Check browser console for WebSocket errors");
          logVite("   • Verify the client is connecting to the correct port");
          logVite("   • Try refreshing the browser page");
        }
      }, 30000); // Check every 30 seconds
    }
    
    // Return the vite instance so we can use it for HTML transformation later
    return vite;
  } catch (error) {
    logViteError("❌ Failed to setup Vite middleware", error as Error);
    logViteError("🔍 Common causes and solutions:");
    logViteError("   1. Port conflict:");
    logViteError("      • Another process may be using the port");
    logViteError("      • Try: PORT=5001 npm run dev");
    logViteError("   2. Missing dependencies:");
    logViteError("      • Run: npm install");
    logViteError("      • Check package.json for missing packages");
    logViteError("   3. Configuration issues:");
    logViteError("      • Check vite.config.ts for syntax errors");
    logViteError("      • Verify plugin configurations");
    logViteError("   4. File system permissions:");
    logViteError("      • Check read/write permissions in project directory");
    logViteError("      • Verify node_modules permissions");
    logViteError("   5. Node.js version compatibility:");
    logViteError("      • Check if Node.js version meets requirements");
    logViteError("      • Try updating Node.js if needed");
    
    logViteError("🚨 Vite setup failed - development server cannot start");
    throw error;
  }
}
