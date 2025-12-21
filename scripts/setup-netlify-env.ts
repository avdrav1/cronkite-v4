#!/usr/bin/env tsx

/**
 * Script to help set up Netlify environment variables for production deployment
 * 
 * This script provides an interactive way to configure all required environment
 * variables for the Cronkite production deployment on Netlify.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import * as readline from 'readline';

interface EnvVar {
  key: string;
  description: string;
  required: boolean;
  sensitive: boolean;
  example?: string;
  validation?: (value: string) => boolean;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  {
    key: 'SUPABASE_URL',
    description: 'Supabase project URL',
    required: true,
    sensitive: false,
    example: 'https://xxxxx.supabase.co',
    validation: (value) => value.startsWith('https://') && value.includes('.supabase.co')
  },
  {
    key: 'SUPABASE_ANON_KEY',
    description: 'Supabase anonymous/public key',
    required: true,
    sensitive: false,
    example: 'eyJ...',
    validation: (value) => value.startsWith('eyJ') && value.length > 100
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Supabase service role key (sensitive)',
    required: true,
    sensitive: true,
    example: 'eyJ...',
    validation: (value) => value.startsWith('eyJ') && value.length > 100
  },
  {
    key: 'DATABASE_URL',
    description: 'PostgreSQL connection string',
    required: true,
    sensitive: true,
    example: 'postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres',
    validation: (value) => value.startsWith('postgresql://') && value.includes('supabase.co')
  },
  {
    key: 'SESSION_SECRET',
    description: 'Session secret key (generate with crypto.randomBytes)',
    required: true,
    sensitive: true,
    example: 'a1b2c3d4e5f6...',
    validation: (value) => value.length >= 32
  },
  {
    key: 'GOOGLE_CLIENT_ID',
    description: 'Google OAuth Client ID',
    required: true,
    sensitive: false,
    example: '123456789-abcdef.apps.googleusercontent.com',
    validation: (value) => value.includes('.apps.googleusercontent.com')
  },
  {
    key: 'GOOGLE_CLIENT_SECRET',
    description: 'Google OAuth Client Secret',
    required: true,
    sensitive: true,
    example: 'GOCSPX-...',
    validation: (value) => value.length > 10
  },
  {
    key: 'APP_URL',
    description: 'Application URL',
    required: true,
    sensitive: false,
    example: 'https://cronkite-v4.netlify.app',
    validation: (value) => value.startsWith('https://')
  },
  {
    key: 'NODE_ENV',
    description: 'Node environment',
    required: true,
    sensitive: false,
    example: 'production',
    validation: (value) => value === 'production'
  },
  {
    key: 'RSS_SYNC_INTERVAL',
    description: 'RSS sync interval in milliseconds',
    required: false,
    sensitive: false,
    example: '3600000',
    validation: (value) => !isNaN(Number(value)) && Number(value) > 0
  },
  {
    key: 'RSS_SYNC_BATCH_SIZE',
    description: 'RSS sync batch size',
    required: false,
    sensitive: false,
    example: '5',
    validation: (value) => !isNaN(Number(value)) && Number(value) > 0
  },
  {
    key: 'RSS_SYNC_MAX_ARTICLES',
    description: 'Maximum articles per RSS sync',
    required: false,
    sensitive: false,
    example: '100',
    validation: (value) => !isNaN(Number(value)) && Number(value) > 0
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function execCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error}`);
  }
}

function checkNetlifyStatus(): { isLoggedIn: boolean; isLinked: boolean; siteName?: string } {
  try {
    const status = execCommand('netlify status');
    const isLoggedIn = status.includes('Current Netlify User');
    const isLinked = status.includes('Current project:');
    
    let siteName: string | undefined;
    if (isLinked) {
      const match = status.match(/Current project:\s*(.+)/);
      siteName = match?.[1]?.trim();
    }
    
    return { isLoggedIn, isLinked, siteName };
  } catch (error) {
    return { isLoggedIn: false, isLinked: false };
  }
}

function getCurrentEnvVars(): Record<string, string> {
  try {
    const output = execCommand('netlify env:list --json');
    const envVars = JSON.parse(output);
    const result: Record<string, string> = {};
    
    for (const envVar of envVars) {
      result[envVar.key] = envVar.value || '[SET]';
    }
    
    return result;
  } catch (error) {
    console.warn('Could not fetch current environment variables:', error);
    return {};
  }
}

function generateSessionSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

async function promptForEnvVar(envVar: EnvVar, currentValue?: string): Promise<string | null> {
  console.log(`\n📝 ${envVar.key}`);
  console.log(`   ${envVar.description}`);
  if (envVar.example) {
    console.log(`   Example: ${envVar.example}`);
  }
  if (currentValue) {
    console.log(`   Current: ${envVar.sensitive ? '[HIDDEN]' : currentValue}`);
  }
  
  // Special handling for session secret
  if (envVar.key === 'SESSION_SECRET' && !currentValue) {
    const useGenerated = await question('   Generate random session secret? (y/n): ');
    if (useGenerated.toLowerCase() === 'y') {
      return generateSessionSecret();
    }
  }
  
  // Special handling for APP_URL
  if (envVar.key === 'APP_URL') {
    const status = checkNetlifyStatus();
    if (status.siteName) {
      const defaultUrl = `https://${status.siteName}.netlify.app`;
      const useDefault = await question(`   Use default URL (${defaultUrl})? (y/n): `);
      if (useDefault.toLowerCase() === 'y') {
        return defaultUrl;
      }
    }
  }
  
  while (true) {
    const value = await question(`   Enter value (or 'skip' to skip): `);
    
    if (value.toLowerCase() === 'skip') {
      if (envVar.required) {
        console.log('   ❌ This variable is required and cannot be skipped.');
        continue;
      }
      return null;
    }
    
    if (envVar.validation && !envVar.validation(value)) {
      console.log('   ❌ Invalid value format. Please check the example and try again.');
      continue;
    }
    
    return value;
  }
}

async function setNetlifyEnvVar(key: string, value: string): Promise<boolean> {
  try {
    execCommand(`netlify env:set ${key} "${value}"`);
    console.log(`   ✅ Set ${key}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Failed to set ${key}: ${error}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Netlify Environment Variables Setup for Cronkite\n');
  
  // Check Netlify status
  const status = checkNetlifyStatus();
  
  if (!status.isLoggedIn) {
    console.log('❌ You are not logged in to Netlify.');
    console.log('Please run: netlify login');
    process.exit(1);
  }
  
  if (!status.isLinked) {
    console.log('❌ This project is not linked to a Netlify site.');
    console.log('Please run: netlify init');
    process.exit(1);
  }
  
  console.log(`✅ Logged in to Netlify`);
  console.log(`✅ Project linked to site: ${status.siteName}\n`);
  
  // Get current environment variables
  console.log('📋 Fetching current environment variables...');
  const currentEnvVars = getCurrentEnvVars();
  
  console.log('\n🔧 Setting up environment variables...');
  console.log('You will be prompted for each required variable.');
  console.log('Enter the values or type "skip" to skip optional variables.\n');
  
  const envVarsToSet: Array<{ key: string; value: string }> = [];
  
  // Prompt for each environment variable
  for (const envVar of REQUIRED_ENV_VARS) {
    const currentValue = currentEnvVars[envVar.key];
    const value = await promptForEnvVar(envVar, currentValue);
    
    if (value !== null) {
      envVarsToSet.push({ key: envVar.key, value });
    } else if (envVar.required) {
      console.log(`❌ Required variable ${envVar.key} was not provided.`);
      process.exit(1);
    }
  }
  
  // Confirm before setting
  console.log('\n📋 Summary of variables to set:');
  for (const { key, value } of envVarsToSet) {
    const envVar = REQUIRED_ENV_VARS.find(v => v.key === key);
    const displayValue = envVar?.sensitive ? '[HIDDEN]' : value;
    console.log(`   ${key}: ${displayValue}`);
  }
  
  const confirm = await question('\n🔄 Proceed with setting these variables? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled.');
    process.exit(0);
  }
  
  // Set environment variables
  console.log('\n🔧 Setting environment variables in Netlify...');
  let successCount = 0;
  
  for (const { key, value } of envVarsToSet) {
    const success = await setNetlifyEnvVar(key, value);
    if (success) {
      successCount++;
    }
  }
  
  console.log(`\n✅ Successfully set ${successCount}/${envVarsToSet.length} environment variables.`);
  
  if (successCount === envVarsToSet.length) {
    console.log('\n🎉 All environment variables have been configured!');
    console.log('\nNext steps:');
    console.log('1. Verify variables: netlify env:list');
    console.log('2. Test build: npm run build');
    console.log('3. Preview deploy: netlify deploy');
    console.log('4. Production deploy: netlify deploy --prod');
  } else {
    console.log('\n⚠️  Some environment variables failed to set.');
    console.log('Please check the errors above and try again.');
  }
  
  rl.close();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n❌ Setup cancelled by user.');
  rl.close();
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Setup failed:', error);
    rl.close();
    process.exit(1);
  });
}