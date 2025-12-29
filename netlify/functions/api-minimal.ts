// Minimal API function to test basic Express setup without complex initialization
import express from 'express';
import serverless from 'serverless-http';

const app = express();

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Minimal API function is working',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
});

// Simple health check without storage
app.get('/api/health-minimal', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'Minimal health check - no storage test'
  });
});

// OAuth callback test without storage
app.post('/api/auth/oauth/callback-minimal', (req, res) => {
  console.log('🔐 Minimal OAuth callback received');
  res.json({
    message: 'Minimal OAuth callback received',
    timestamp: new Date().toISOString(),
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
});

// Create serverless handler
const handler = serverless(app, {
  basePath: '/.netlify/functions'
});

export { handler };