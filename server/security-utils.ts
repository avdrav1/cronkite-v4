/**
 * Security Utilities Module
 * 
 * Provides utilities for handling sensitive data securely:
 * - Secret sanitization for logging
 * - Environment variable security validation
 * - Safe error message generation
 */

/**
 * List of environment variable names that contain sensitive data
 */
const SENSITIVE_ENV_VARS = [
  'SESSION_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID',
  'JWT_SECRET',
  'API_KEY',
  'PRIVATE_KEY',
  'SECRET_KEY',
  'PASSWORD',
  'TOKEN',
  'CREDENTIAL'
];

/**
 * Patterns that indicate sensitive data in strings
 * These patterns are designed to catch actual secrets, not legitimate code patterns
 */
const SENSITIVE_PATTERNS = [
  /password\s*[=:]\s*['"][^'"]{8,}['"]/gi, // Actual password values (8+ chars)
  /secret\s*[=:]\s*['"][^'"]{16,}['"]/gi, // Actual secret values (16+ chars)
  /token\s*[=:]\s*['"][^'"]{20,}['"]/gi, // Actual token values (20+ chars)
  /api[_-]?key\s*[=:]\s*['"][^'"]{16,}['"]/gi, // API key values (16+ chars)
  /private[_-]?key\s*[=:]\s*['"][^'"]{32,}['"]/gi, // Private key values (32+ chars)
  /credential\s*[=:]\s*['"][^'"]{16,}['"]/gi, // Credential values (16+ chars)
  /postgresql:\/\/[^:]+:[^@]{8,}@/gi, // Database URLs with actual passwords
  /https:\/\/[^:]+:[^@]{8,}@/gi, // URLs with actual credentials
  /Bearer\s+[A-Za-z0-9\-._~+/]{20,}=*/gi, // Bearer tokens (20+ chars)
  /eyJ[A-Za-z0-9\-._~+/]{20,}=*/gi, // JWT tokens (start with eyJ, 20+ chars)
  /sk_[a-zA-Z0-9]{20,}/gi, // Stripe secret keys
  /pk_[a-zA-Z0-9]{20,}/gi, // Stripe public keys (still sensitive)
  /AIza[0-9A-Za-z\-_]{35}/gi, // Google API keys
  /ya29\.[0-9A-Za-z\-_]+/gi, // Google OAuth tokens
];

/**
 * Sanitize a string by replacing sensitive data with placeholders
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Replace sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      // Keep the key part, hide the value part
      const parts = match.split(/[=:]/);
      if (parts.length >= 2) {
        return `${parts[0]}=${parts[0].includes('://') ? '[REDACTED_URL]' : '[REDACTED]'}`;
      }
      return '[REDACTED]';
    });
  }

  return sanitized;
}

/**
 * Sanitize an object by replacing sensitive values with placeholders
 */
export function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    
    // Check if key indicates sensitive data
    const isSensitiveKey = SENSITIVE_ENV_VARS.some(sensitiveVar => 
      keyLower === sensitiveVar.toLowerCase() || // Exact match
      (keyLower.includes('password') && keyLower.length < 20) || // Short password fields
      (keyLower.includes('secret') && keyLower.length < 20) || // Short secret fields
      (keyLower.includes('token') && keyLower.length < 20) || // Short token fields
      (keyLower.includes('key') && keyLower.length < 20 && !keyLower.includes('keyboard')) || // Short key fields, not keyboard
      (keyLower.includes('credential') && keyLower.length < 20) // Short credential fields
    );

    if (isSensitiveKey && typeof value === 'string') {
      // Replace with placeholder, showing only first/last few characters for debugging
      if (value.length > 8) {
        sanitized[key] = `${value.substring(0, 4)}...[REDACTED]...${value.substring(value.length - 4)}`;
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof value === 'string') {
      // Sanitize string values for patterns
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create a safe error message that doesn't expose sensitive information
 */
export function createSafeErrorMessage(error: Error | string, context?: string): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const sanitizedMessage = sanitizeString(errorMessage);
  
  if (context) {
    return `${context}: ${sanitizedMessage}`;
  }
  
  return sanitizedMessage;
}

/**
 * Validate that environment variables don't contain obvious security issues
 */
export function validateEnvironmentSecurity(): {
  isSecure: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for common security issues
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret) {
    // Check for weak session secrets
    if (sessionSecret === 'your_session_secret_key' || 
        sessionSecret === 'development' || 
        sessionSecret === 'secret' ||
        sessionSecret.length < 32) {
      if (process.env.NODE_ENV === 'production') {
        errors.push('SESSION_SECRET is weak or default value in production');
      } else {
        warnings.push('SESSION_SECRET is weak or default value (acceptable in development)');
      }
    }
  }

  // Check for development keys in production
  if (process.env.NODE_ENV === 'production') {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl && supabaseUrl.includes('127.0.0.1')) {
      errors.push('Using localhost Supabase URL in production');
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl && databaseUrl.includes('127.0.0.1')) {
      errors.push('Using localhost database URL in production');
    }

    // Check for demo/development keys
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (anonKey && anonKey.includes('supabase-demo')) {
      errors.push('Using demo Supabase keys in production');
    }
  }

  // Check for exposed secrets in environment
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      // Check if non-sensitive env vars contain sensitive patterns
      const keyLower = key.toLowerCase();
      const isSensitiveVar = SENSITIVE_ENV_VARS.some(sensitiveVar => 
        keyLower.includes(sensitiveVar.toLowerCase())
      );

      if (!isSensitiveVar) {
        // Check if non-sensitive var contains sensitive data (only check for actual secret patterns)
        const hasSensitivePattern = SENSITIVE_PATTERNS.some(pattern => {
          // Reset regex lastIndex to ensure proper matching
          pattern.lastIndex = 0;
          return pattern.test(value);
        });

        if (hasSensitivePattern) {
          warnings.push(`Environment variable '${key}' may contain sensitive data`);
        }
      }
    }
  }

  return {
    isSecure: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Safe JSON stringify that automatically sanitizes sensitive data
 */
export function safeStringify(obj: any, space?: number): string {
  const sanitized = sanitizeObject(obj);
  return JSON.stringify(sanitized, null, space);
}

/**
 * Safe console.log that automatically sanitizes sensitive data
 */
export function safeLog(message: string, ...args: any[]): void {
  const sanitizedMessage = sanitizeString(message);
  const sanitizedArgs = args.map(arg => 
    typeof arg === 'object' ? sanitizeObject(arg) : 
    typeof arg === 'string' ? sanitizeString(arg) : arg
  );
  
  console.log(sanitizedMessage, ...sanitizedArgs);
}

/**
 * Safe console.error that automatically sanitizes sensitive data
 */
export function safeError(message: string, error?: Error, ...args: any[]): void {
  const sanitizedMessage = sanitizeString(message);
  const sanitizedArgs = args.map(arg => 
    typeof arg === 'object' ? sanitizeObject(arg) : 
    typeof arg === 'string' ? sanitizeString(arg) : arg
  );
  
  if (error) {
    const sanitizedError = new Error(sanitizeString(error.message));
    sanitizedError.stack = error.stack ? sanitizeString(error.stack) : undefined;
    console.error(sanitizedMessage, sanitizedError, ...sanitizedArgs);
  } else {
    console.error(sanitizedMessage, ...sanitizedArgs);
  }
}

/**
 * Check if a string contains sensitive data
 */
export function containsSensitiveData(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  return SENSITIVE_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Validate that client-side code doesn't expose server secrets
 */
export function validateClientCodeSecurity(clientCode: string): {
  isSecure: boolean;
  exposedSecrets: string[];
} {
  const exposedSecrets: string[] = [];

  // Check for server-only environment variables in client code
  const serverOnlyVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'SESSION_SECRET',
    'GOOGLE_CLIENT_SECRET'
  ];

  for (const varName of serverOnlyVars) {
    const pattern = new RegExp(`process\\.env\\.${varName}`, 'g');
    if (pattern.test(clientCode)) {
      exposedSecrets.push(varName);
    }
  }

  // Check for hardcoded sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    // Reset regex lastIndex to ensure proper matching
    pattern.lastIndex = 0;
    const matches = clientCode.match(pattern);
    if (matches) {
      exposedSecrets.push(...matches);
    }
  }

  return {
    isSecure: exposedSecrets.length === 0,
    exposedSecrets
  };
}