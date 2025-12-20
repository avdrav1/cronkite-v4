// Netlify Function handler for production deployment
import express from 'express';

// Import environment configuration
import './env';

// Import the main application setup
import { setupApp } from './app-setup';

let app: express.Application | null = null;

// Initialize the Express app (singleton pattern for serverless)
async function getApp(): Promise<express.Application> {
  if (!app) {
    app = express();
    await setupApp(app);
  }
  return app;
}

// Netlify Function handler
export const handler = async (event: any, context: any) => {
  try {
    const expressApp = await getApp();
    
    // Convert Netlify event to Express-compatible request
    const req = {
      method: event.httpMethod,
      url: event.path + (event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : ''),
      headers: event.headers || {},
      body: event.body,
      rawBody: event.body,
      // Add Netlify-specific context
      netlify: {
        event,
        context
      }
    };

    // Create response object
    let responseData = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: ''
    };

    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
      
      status(code: number) {
        responseData.statusCode = code;
        return this;
      },
      
      json(data: any) {
        responseData.body = JSON.stringify(data);
        responseData.headers['Content-Type'] = 'application/json';
        return this;
      },
      
      send(data: any) {
        responseData.body = typeof data === 'string' ? data : JSON.stringify(data);
        return this;
      },
      
      set(headers: Record<string, string>) {
        Object.assign(responseData.headers, headers);
        return this;
      },
      
      end(data?: any) {
        if (data) {
          responseData.body = typeof data === 'string' ? data : JSON.stringify(data);
        }
        return this;
      }
    };

    // Process request through Express app
    return new Promise((resolve, reject) => {
      // Handle the request
      expressApp(req as any, res as any, (err: any) => {
        if (err) {
          console.error('Express app error:', err);
          resolve({
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
          });
        } else {
          resolve(responseData);
        }
      });
    });

  } catch (error) {
    console.error('Netlify function error:', error);
    
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