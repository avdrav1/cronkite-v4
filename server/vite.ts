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
    
    logVite(`🚀 Creating Vite server with middleware mode on port ${port}...`);
    const vite = await createViteServer({
      configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
      customLogger: {
        ...viteLogger,
        error: (msg, options) => {
          // Suppress WebSocket errors to prevent spam
          if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('HMR')) {
            // Silently ignore WebSocket errors for now
            return;
          }
          logViteError(`❌ Vite error: ${msg}`);
          viteLogger.error(msg, options);
        },
        warn: (msg, options) => {
          // Suppress WebSocket warnings
          if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('HMR')) {
            return;
          }
          viteLogger.warn(msg, options);
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
      server: {
        middlewareMode: true,
        hmr: false, // Disable HMR to prevent WebSocket issues
      },
      appType: "custom",
    });

    logVite("🔌 Registering Vite middleware...");
    // Register Vite middleware - it handles module requests with proper MIME types
    app.use(vite.middlewares);

    logViteSuccess("✅ Vite middleware setup completed successfully");
    logViteSuccess("⚠️  HMR disabled to prevent WebSocket conflicts");
    
    // Return the vite instance so we can use it for HTML transformation later
    return vite;
  } catch (error) {
    logViteError("❌ Failed to setup Vite middleware", error as Error);
    throw error;
  }
}
