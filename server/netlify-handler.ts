// Netlify Function handler for production deployment
// Note: node-polyfills.ts is injected by ESBuild at build time (see script/build.ts)

import serverless from 'serverless-http';
import express from 'express';

// Import environment configuration
import './env';

let app: express.Application | null = null;
let serverlessHandler: any = null;

// Initialize the Express app (singleton pattern for serverless)
async function getServerlessHandler() {
  if (!serverlessHandler) {
    console.log('🚀 Initializing Netlify function handler...');
    
    try {
      app = express();
      
      // Trust proxy for Netlify
      app.set('trust proxy', 1);
      
      // Add basic middleware first
      app.use(express.json());
      
      // Add a simple health check that doesn't require complex setup
      app.get('/api/health-basic', (req, res) => {
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          message: 'Basic health check - no complex initialization'
        });
      });
      
      // Add a storage debug endpoint
      app.get('/api/debug-storage', async (req, res) => {
        console.log('🔍 Debug storage: Starting...');
        
        try {
          console.log('🔍 Debug storage: Importing getStorage...');
          const { getStorage } = await import('./storage');
          
          console.log('🔍 Debug storage: Calling getStorage()...');
          const storage = await getStorage();
          
          console.log('🔍 Debug storage: Storage obtained, testing...');
          const feeds = await storage.getRecommendedFeeds();
          
          console.log(`🔍 Debug storage: Success! Got ${feeds.length} feeds`);
          
          res.json({
            success: true,
            message: 'Storage working correctly',
            feedCount: feeds.length,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Debug storage: Error:', error);
          res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      // Try to import and setup the main app
      try {
        console.log('🔧 Attempting to import app-setup...');
        const { setupApp } = await import('./app-setup');
        
        console.log('🔧 Running setupApp...');
        await setupApp(app);
        
        console.log('✅ App setup completed successfully');
      } catch (setupError) {
        console.error('❌ App setup failed, using minimal fallback:', setupError);
        
        // Add minimal fallback routes
        app.get('/api/health', (req, res) => {
          res.status(500).json({
            status: 'degraded',
            timestamp: new Date().toISOString(),
            error: 'App setup failed',
            message: setupError instanceof Error ? setupError.message : 'Unknown setup error'
          });
        });
        
        app.post('/api/auth/oauth/callback', (req, res) => {
          console.log('❌ OAuth callback: Using fallback route due to app setup failure');
          console.log('❌ OAuth callback: Request body:', JSON.stringify(req.body, null, 2));
          res.status(500).json({
            error: 'Authentication unavailable',
            message: 'Server initialization failed - OAuth callback not properly configured',
            timestamp: new Date().toISOString(),
            details: setupError instanceof Error ? setupError.message : 'Unknown setup error'
          });
        });
      }
      
      // Note: AI background scheduler is NOT started in serverless environment
      // because serverless functions don't persist between requests.
      // Clustering will use on-demand text-based fallback instead.
      console.log('ℹ️ AI background scheduler disabled in serverless mode - using on-demand clustering');
      
      // Create serverless handler
      // The redirect in netlify.toml sends /api/* to /.netlify/functions/api/:splat
      // So /api/clusters/123 becomes /.netlify/functions/api/clusters/123
      // We need to strip /.netlify/functions/api but keep /api for Express routes
      serverlessHandler = serverless(app, {
        // Don't strip /api - Express routes expect it
        basePath: '/.netlify/functions'
      });
      
      console.log('✅ Netlify function handler initialized');
    } catch (error) {
      console.error('❌ Critical: Failed to initialize Netlify function handler:', error);
      
      // Create a minimal error handler
      const errorApp = express();
      errorApp.use('*', (req, res) => {
        res.status(500).json({
          error: 'Server initialization failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      });
      
      serverlessHandler = serverless(errorApp, {
        basePath: '/.netlify/functions'
      });
    }
  }
  return serverlessHandler;
}

// Netlify Function handler
export const handler = async (event: any, context: any) => {
  try {
    // Ensure handler is initialized
    const handlerFn = await getServerlessHandler();
    
    // Log request for debugging
    console.log(`📥 ${event.httpMethod} ${event.path}`);
    
    // Call the serverless handler
    const response = await handlerFn(event, context);
    
    // Log response status
    console.log(`📤 Response: ${response.statusCode}`);
    
    return response;
  } catch (error) {
    console.error('❌ Netlify function error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};
