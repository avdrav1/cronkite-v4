/**
 * Client Security Validation Script
 * 
 * Validates that client-side code doesn't expose server secrets
 * This script should be run as part of the build process
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { validateClientCodeSecurity } from '../server/security-utils';

/**
 * Server-only environment variables that should never appear in client code
 */
const SERVER_ONLY_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'JWT_SECRET',
  'PRIVATE_KEY'
];

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string, extensions: string[] = ['.js', '.ts', '.tsx', '.jsx']): string[] {
  const files: string[] = [];
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other build directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
          files.push(...getAllFiles(fullPath, extensions));
        }
      } else if (extensions.includes(extname(item))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}:`, error);
  }
  
  return files;
}

/**
 * Validate a single file for security issues
 */
function validateFile(filePath: string): {
  isSecure: boolean;
  exposedSecrets: string[];
  serverOnlyVars: string[];
} {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // Skip validation for test files with obvious test data
    const isTestFile = filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('/test/');
    
    // Use the security utility to validate
    const validation = validateClientCodeSecurity(content);
    
    // Also check for server-only environment variables
    const serverOnlyVars: string[] = [];
    for (const varName of SERVER_ONLY_VARS) {
      const patterns = [
        new RegExp(`process\\.env\\.${varName}`, 'g'),
        new RegExp(`import\\.meta\\.env\\.${varName}`, 'g'),
        new RegExp(`\\$\\{${varName}\\}`, 'g'), // Template literals
        new RegExp(`"${varName}"`, 'g'), // Direct string references
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          serverOnlyVars.push(varName);
          break;
        }
      }
    }
    
    // For test files, only check for server-only vars, not hardcoded secrets
    const exposedSecrets = isTestFile ? [] : validation.exposedSecrets;
    
    return {
      isSecure: exposedSecrets.length === 0 && serverOnlyVars.length === 0,
      exposedSecrets,
      serverOnlyVars
    };
    
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}:`, error);
    return {
      isSecure: true,
      exposedSecrets: [],
      serverOnlyVars: []
    };
  }
}

/**
 * Main validation function
 */
export function validateClientSecurity(clientDir: string = 'client'): {
  isSecure: boolean;
  violations: Array<{
    file: string;
    exposedSecrets: string[];
    serverOnlyVars: string[];
  }>;
} {
  console.log('🔒 Validating client-side security...');
  
  const clientFiles = getAllFiles(clientDir);
  const violations: Array<{
    file: string;
    exposedSecrets: string[];
    serverOnlyVars: string[];
  }> = [];
  
  for (const file of clientFiles) {
    const validation = validateFile(file);
    
    if (!validation.isSecure) {
      violations.push({
        file,
        exposedSecrets: validation.exposedSecrets,
        serverOnlyVars: validation.serverOnlyVars
      });
    }
  }
  
  if (violations.length === 0) {
    console.log('✅ Client security validation passed');
    return { isSecure: true, violations: [] };
  } else {
    console.error('❌ Client security validation failed');
    console.error(`Found ${violations.length} files with security violations:`);
    
    for (const violation of violations) {
      console.error(`\n📁 File: ${violation.file}`);
      
      if (violation.serverOnlyVars.length > 0) {
        console.error('   🚨 Server-only environment variables found:');
        for (const varName of violation.serverOnlyVars) {
          console.error(`      • ${varName}`);
        }
      }
      
      if (violation.exposedSecrets.length > 0) {
        console.error('   🔓 Exposed secrets found:');
        for (const secret of violation.exposedSecrets) {
          console.error(`      • ${secret.substring(0, 50)}...`);
        }
      }
    }
    
    console.error('\n💡 Fix these issues before deploying to production!');
    return { isSecure: false, violations };
  }
}

/**
 * CLI interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const clientDir = process.argv[2] || 'client';
  const result = validateClientSecurity(clientDir);
  
  if (!result.isSecure) {
    process.exit(1);
  }
}