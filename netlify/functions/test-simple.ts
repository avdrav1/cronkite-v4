// Simple test function to verify Netlify Functions are working
export const handler = async (event: any, context: any) => {
  console.log('🧪 Simple test function called');
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Simple test function is working',
      timestamp: new Date().toISOString(),
      event: {
        httpMethod: event.httpMethod,
        path: event.path,
        headers: Object.keys(event.headers || {}),
      }
    })
  };
};