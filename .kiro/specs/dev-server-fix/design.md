# Design Document

## Overview

The development server issue stems from a port configuration mismatch and Vite middleware setup problems. The current setup has the Express server running on port 5000 with Vite in middleware mode, but the client is trying to connect to both port 5000 and port 5173, causing MIME type errors and WebSocket connection failures.

## Architecture

The application uses a unified server approach where:
- Express server handles API routes and serves the client in production
- In development, Vite middleware is integrated into the Express server
- All traffic goes through a single port (5000) to avoid CORS and connection issues
- HMR (Hot Module Replacement) WebSocket connections should use the same port as the main server

## Components and Interfaces

### Vite Configuration Component
- **Purpose**: Configure Vite to work properly in middleware mode
- **Interface**: Vite config object with server settings
- **Key Settings**: 
  - Server port alignment
  - HMR WebSocket path configuration
  - Middleware mode settings

### Express Server Integration
- **Purpose**: Integrate Vite middleware with Express server
- **Interface**: Express app with Vite middleware
- **Key Functions**:
  - Vite middleware registration
  - Static file serving
  - HMR WebSocket handling

### Development Scripts
- **Purpose**: Provide consistent development commands
- **Interface**: npm scripts in package.json
- **Key Commands**:
  - Unified development server startup
  - Port configuration management

## Data Models

### Server Configuration
```typescript
interface ServerConfig {
  port: number;
  host: string;
  hmrPath: string;
  middlewareMode: boolean;
}
```

### Vite Server Options
```typescript
interface ViteServerOptions {
  middlewareMode: boolean;
  hmr: {
    server: Server;
    path: string;
  };
  allowedHosts: boolean;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: JavaScript modules served with correct MIME type
*For any* JavaScript module request to the development server, the response SHALL have Content-Type header set to a JavaScript MIME type (application/javascript or text/javascript)
**Validates: Requirements 1.2, 1.4**

Property 2: Module requests return JavaScript content, not HTML
*For any* request to a JavaScript module path (ending in .js, .jsx, .ts, .tsx), the response body SHALL contain JavaScript code, not HTML markup
**Validates: Requirements 1.5**

## Error Handling

### Port Conflict Handling
- Check if the target port is already in use before starting the server
- If port is occupied, log a clear error message indicating the port number
- Optionally attempt to use an alternative port and report the actual port being used

### MIME Type Error Prevention
- Ensure Vite middleware is registered before the catch-all HTML route
- Configure Vite to handle module requests with proper Content-Type headers
- Prevent the HTML fallback route from intercepting module requests

### WebSocket Connection Failures
- Configure HMR WebSocket to use the same server instance as Express
- Set explicit HMR path to avoid conflicts
- Log WebSocket connection attempts and failures with specific details

## Testing Strategy

### Unit Testing
We will use Vitest for unit testing with the following focus areas:

**Configuration Tests**:
- Verify Vite configuration has correct server settings
- Verify Express server uses consistent port configuration
- Verify HMR WebSocket path is correctly configured

**Integration Tests**:
- Test that the development server starts successfully
- Test that module requests return correct MIME types
- Test that WebSocket connections can be established

### Property-Based Testing
We will use fast-check for property-based testing with the following properties:

**Property 1: JavaScript modules served with correct MIME type**
- Generate various JavaScript module paths
- Make HTTP requests to each path
- Verify all responses have correct Content-Type headers
- Run 100 iterations minimum

**Property 2: Module requests return JavaScript content, not HTML**
- Generate various module file paths
- Request each path from the server
- Verify response body contains JavaScript, not HTML
- Run 100 iterations minimum

Each property-based test will be tagged with:
- `**Feature: dev-server-fix, Property {number}: {property_text}**`

### Manual Testing
- Start the development server and verify the application loads in the browser
- Check browser console for MIME type errors
- Verify HMR works by making a code change and observing live reload
- Test on different browsers to ensure consistent behavior

## Implementation Notes

### Root Cause Analysis
The current issue is caused by:
1. Vite middleware not being properly configured for middleware mode
2. Potential race condition where the catch-all HTML route intercepts module requests
3. HMR WebSocket trying to connect to wrong port (5173 instead of 5000)

### Solution Approach
1. Ensure Vite middleware is registered in the correct order
2. Configure HMR to use the same HTTP server instance
3. Remove any hardcoded port references that don't use the PORT environment variable
4. Verify the catch-all route only handles non-module requests

### Configuration Changes Required
- Update `server/vite.ts` to ensure proper middleware registration order
- Verify `vite.config.ts` doesn't have conflicting port settings
- Ensure `server/index.ts` properly integrates Vite middleware
- Update any client-side code that hardcodes port numbers