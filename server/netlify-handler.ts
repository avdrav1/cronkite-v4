// Netlify Function handler for production deployment
import serverless from 'serverless-http';
import express from 'express';

// Import environment configuration
import './env';

// Import the main application setup
import { setupApp } from './app-setup';

let app: express.Application | null = null;
let serverlessHandler: any = null;

// Initialize the Express app (singleton pattern for serverless)
async function getServerlessHandler() {
  if (!serverlessHandler) {
    console.log('🚀 Initializing Netlify function handler...');
    
    app = express();
    
    // Trust proxy for Netlify
    app.set('trust proxy', 1);
    
    await setupApp(app);
    
    // Note: AI background scheduler is NOT started in serverless environment
    // because serverless functions don't persist between requests.
    // Clustering will use on-demand text-based fallback instead.
    console.log('ℹ️ AI background scheduler disabled in serverless mode - using on-demand clustering');
    
    // Create serverless handler
    serverlessHandler = serverless(app, {
      // Strip the /.netlify/functions/api prefix
      basePath: '/.netlify/functions/api'
    });
    
    console.log('✅ Netlify function handler initialized');
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
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
