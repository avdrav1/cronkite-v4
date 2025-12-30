// Debug function to test OAuth callback in production
export const handler = async (event: any, context: any) => {
  console.log('🔍 OAuth Debug: Function called');
  console.log('🔍 OAuth Debug: Event:', JSON.stringify(event, null, 2));
  
  try {
    // Test basic functionality
    const body = JSON.parse(event.body || '{}');
    console.log('🔍 OAuth Debug: Parsed body:', JSON.stringify(body, null, 2));
    
    // Test session structure
    const session = body.session;
    if (!session) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'No session provided',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Test user data
    const user = session.user || session;
    if (!user || !user.id || !user.email) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid user data',
          user: user,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Test environment variables
    const envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: !!process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV
    };
    
    console.log('🔍 OAuth Debug: Environment check:', envCheck);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'OAuth debug successful',
        user: {
          id: user.id,
          email: user.email,
          hasMetadata: !!user.user_metadata
        },
        environment: envCheck,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('🔍 OAuth Debug: Error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Debug function failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
    };
  }
};