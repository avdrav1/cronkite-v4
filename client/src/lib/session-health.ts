/**
 * Session health monitoring utilities
 * Helps detect and recover from session issues
 */

let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Performs a lightweight session health check
 * Returns true if session is healthy, false if it needs refresh
 */
export async function checkSessionHealth(): Promise<boolean> {
  const now = Date.now();
  
  // Don't check too frequently
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return true;
  }
  
  lastHealthCheck = now;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch('/api/auth/health', {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Session health check failed:', error);
    return false;
  }
}

/**
 * Monitors session health and triggers refresh if needed
 */
export function startSessionMonitoring() {
  // Check session health periodically
  const interval = setInterval(async () => {
    const isHealthy = await checkSessionHealth();
    if (!isHealthy) {
      console.log('🔐 Session health check failed, triggering auth refresh');
      window.dispatchEvent(new CustomEvent('session-unhealthy'));
    }
  }, HEALTH_CHECK_INTERVAL);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
  });
  
  return () => clearInterval(interval);
}
