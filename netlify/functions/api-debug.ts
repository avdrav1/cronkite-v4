// Debug version of API function to isolate initialization issues
import express from 'express';
import serverless from 'serverless-http';

console.log('🔍 API Debug: Starting initialization...');

const app = express();

console.log('🔍 API Debug: Express app created');

// Trust proxy for Netlify
app.set('trust proxy', 1);

console.log('🔍 API Debug: Proxy settings configured');

// Add basic middleware
app.use(express.json());

console.log('🔍 API Debug: Basic middleware added');

// Test route that doesn't require any complex setup
app.get('/api/debug-test', (req, res) => {
  console.log('🔍 API Debug: Test route called');
  res.json({
    message: 'Debug API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
});

// Test storage initialization separately
app.get('/api/debug-storage', async (req, res) => {
  console.log('🔍 API Debug: Testing storage initialization...');
  
  try {
    // Try to import storage
    console.log('🔍 API Debug: Importing storage module...');
    const { getStorage } = await import('../../server/storage');
    
    console.log('🔍 API Debug: Storage module imported, getting instance...');
    const storage = await getStorage();
    
    console.log('🔍 API Debug: Storage instance obtained');
    
    res.json({
      message: 'Storage initialization successful',
      timestamp: new Date().toISOString(),
      storageType: storage.constructor.name
    });
  } catch (error) {
    console.error('❌ API Debug: Storage initialization failed:', error);
    res.status(500).json({
      error: 'Storage initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Test app setup separately
app.get('/api/debug-setup', async (req, res) => {
  console.log('🔍 API Debug: Testing app setup...');
  
  try {
    console.log('🔍 API Debug: Importing app-setup module...');
    const { setupApp } = await import('../../server/app-setup');
    
    console.log('🔍 API Debug: App-setup module imported');
    
    // Create a test app for setup
    const testApp = express();
    
    console.log('🔍 API Debug: Running setupApp...');
    await setupApp(testApp);
    
    console.log('🔍 API Debug: App setup completed');
    
    res.json({
      message: 'App setup successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ API Debug: App setup failed:', error);
    res.status(500).json({
      error: 'App setup failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

console.log('🔍 API Debug: Creating serverless handler...');

// Create serverless handler
const handler = serverless(app, {
  basePath: '/.netlify/functions'
});

console.log('🔍 API Debug: Serverless handler created');

export { handler };