#!/usr/bin/env tsx

/**
 * Deploy and Validate Script for Cronkite Production Deployment
 * 
 * This script handles the complete deployment process to Netlify and validates
 * that all functionality works correctly in the production environment.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import * as readline from 'readline';

interface ValidationResult {
  success: boolean;
  message: string;
  details?: string;
}

interface DeploymentInfo {
  url: string;
  deployId: string;
  isProduction: boolean;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function execCommand(command: string, options: { silent?: boolean } = {}): string {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit'
    });
    return typeof result === 'string' ? result.trim() : '';
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

async function checkPrerequisites(): Promise<ValidationResult> {
  console.log('🔍 Checking deployment prerequisites...');
  
  try {
    // Check Netlify CLI
    execCommand('netlify --version', { silent: true });
    
    // Check Netlify login status
    const status = execCommand('netlify status', { silent: true });
    if (!status.includes('Current Netlify User')) {
      return {
        success: false,
        message: 'Not logged in to Netlify',
        details: 'Run: netlify login'
      };
    }
    
    // Check project linking
    if (!status.includes('Current project:')) {
      return {
        success: false,
        message: 'Project not linked to Netlify site',
        details: 'Run: netlify init'
      };
    }
    
    // Check environment variables
    const envList = execCommand('netlify env:list --json', { silent: true });
    const envVars = JSON.parse(envList);
    
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'DATABASE_URL',
      'SESSION_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'APP_URL',
      'NODE_ENV'
    ];
    
    const missingVars = requiredVars.filter(varName => 
      !envVars.some((env: any) => env.key === varName)
    );
    
    if (missingVars.length > 0) {
      return {
        success: false,
        message: 'Missing required environment variables',
        details: `Missing: ${missingVars.join(', ')}\nRun: npm run netlify:env:setup`
      };
    }
    
    console.log('✅ All prerequisites met');
    return { success: true, message: 'Prerequisites check passed' };
    
  } catch (error: any) {
    return {
      success: false,
      message: 'Prerequisites check failed',
      details: error.message
    };
  }
}

async function buildApplication(): Promise<ValidationResult> {
  console.log('🏗️  Building application for production...');
  
  try {
    // Run production build
    execCommand('NODE_ENV=production npm run build');
    
    console.log('✅ Build completed successfully');
    return { success: true, message: 'Build completed' };
    
  } catch (error: any) {
    return {
      success: false,
      message: 'Build failed',
      details: error.message
    };
  }
}

async function deployToNetlify(isProduction: boolean = false): Promise<DeploymentInfo | null> {
  console.log(`🚀 Deploying to Netlify ${isProduction ? '(PRODUCTION)' : '(PREVIEW)'}...`);
  
  try {
    const deployCommand = isProduction ? 'netlify deploy --prod' : 'netlify deploy';
    const output = execCommand(deployCommand, { silent: true });
    
    // Parse deployment output
    const urlMatch = output.match(/Website URL:\s*(.+)/);
    const deployIdMatch = output.match(/Deploy ID:\s*(.+)/);
    
    if (!urlMatch) {
      throw new Error('Could not parse deployment URL from output');
    }
    
    const deploymentInfo: DeploymentInfo = {
      url: urlMatch[1].trim(),
      deployId: deployIdMatch?.[1]?.trim() || 'unknown',
      isProduction
    };
    
    console.log(`✅ Deployment successful!`);
    console.log(`   URL: ${deploymentInfo.url}`);
    console.log(`   Deploy ID: ${deploymentInfo.deployId}`);
    
    return deploymentInfo;
    
  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);
    return null;
  }
}

async function validateDeployment(deploymentInfo: DeploymentInfo): Promise<ValidationResult[]> {
  console.log('🧪 Validating deployment functionality...');
  
  const results: ValidationResult[] = [];
  const baseUrl = deploymentInfo.url;
  
  // Basic connectivity test
  try {
    console.log('   Testing basic connectivity...');
    const response = await fetch(baseUrl);
    if (response.ok) {
      results.push({ success: true, message: 'Site is accessible' });
    } else {
      results.push({ 
        success: false, 
        message: 'Site not accessible',
        details: `HTTP ${response.status}: ${response.statusText}`
      });
    }
  } catch (error: any) {
    results.push({ 
      success: false, 
      message: 'Site connectivity failed',
      details: error.message
    });
  }
  
  // API endpoint test
  try {
    console.log('   Testing API endpoints...');
    const apiResponse = await fetch(`${baseUrl}/api/health`);
    if (apiResponse.ok) {
      results.push({ success: true, message: 'API endpoints accessible' });
    } else {
      results.push({ 
        success: false, 
        message: 'API endpoints not accessible',
        details: `HTTP ${apiResponse.status}: ${apiResponse.statusText}`
      });
    }
  } catch (error: any) {
    results.push({ 
      success: false, 
      message: 'API endpoint test failed',
      details: error.message
    });
  }
  
  // SPA routing test
  try {
    console.log('   Testing SPA routing...');
    const routes = ['/auth', '/onboarding', '/settings'];
    
    for (const route of routes) {
      const routeResponse = await fetch(`${baseUrl}${route}`);
      if (!routeResponse.ok) {
        results.push({ 
          success: false, 
          message: `SPA route ${route} not accessible`,
          details: `HTTP ${routeResponse.status}: ${routeResponse.statusText}`
        });
        break;
      }
    }
    
    results.push({ success: true, message: 'SPA routing works correctly' });
    
  } catch (error: any) {
    results.push({ 
      success: false, 
      message: 'SPA routing test failed',
      details: error.message
    });
  }
  
  // Content validation
  try {
    console.log('   Testing content delivery...');
    const response = await fetch(baseUrl);
    const html = await response.text();
    
    if (html.includes('<title>') && html.includes('Cronkite')) {
      results.push({ success: true, message: 'Content delivered correctly' });
    } else {
      results.push({ 
        success: false, 
        message: 'Content not delivered correctly',
        details: 'HTML does not contain expected content'
      });
    }
  } catch (error: any) {
    results.push({ 
      success: false, 
      message: 'Content validation failed',
      details: error.message
    });
  }
  
  return results;
}

async function checkNetlifyFunctionLogs(deployId: string): Promise<ValidationResult> {
  console.log('📋 Checking Netlify function logs...');
  
  try {
    // Get recent function logs
    const logs = execCommand(`netlify logs:functions --since 1h`, { silent: true });
    
    if (logs.includes('ERROR') || logs.includes('FATAL')) {
      return {
        success: false,
        message: 'Function errors detected in logs',
        details: 'Check Netlify dashboard for detailed error logs'
      };
    }
    
    return { success: true, message: 'No function errors detected' };
    
  } catch (error: any) {
    return {
      success: false,
      message: 'Could not check function logs',
      details: error.message
    };
  }
}

async function generateValidationReport(
  deploymentInfo: DeploymentInfo,
  validationResults: ValidationResult[],
  functionLogsResult: ValidationResult
): Promise<void> {
  const timestamp = new Date().toISOString();
  const reportPath = `DEPLOYMENT_VALIDATION_REPORT_${timestamp.split('T')[0]}.md`;
  
  const report = `# Deployment Validation Report

**Date:** ${timestamp}
**Deployment Type:** ${deploymentInfo.isProduction ? 'Production' : 'Preview'}
**URL:** ${deploymentInfo.url}
**Deploy ID:** ${deploymentInfo.deployId}

## Validation Results

${validationResults.map(result => 
  `- ${result.success ? '✅' : '❌'} ${result.message}${result.details ? `\n  Details: ${result.details}` : ''}`
).join('\n')}

## Function Logs Check

- ${functionLogsResult.success ? '✅' : '❌'} ${functionLogsResult.message}${functionLogsResult.details ? `\n  Details: ${functionLogsResult.details}` : ''}

## Summary

**Total Tests:** ${validationResults.length + 1}
**Passed:** ${validationResults.filter(r => r.success).length + (functionLogsResult.success ? 1 : 0)}
**Failed:** ${validationResults.filter(r => !r.success).length + (functionLogsResult.success ? 0 : 1)}

**Overall Status:** ${validationResults.every(r => r.success) && functionLogsResult.success ? '✅ PASSED' : '❌ FAILED'}

## Next Steps

${deploymentInfo.isProduction ? 
  `### Production Deployment Complete

- Monitor the application for any issues
- Check user feedback and error reports
- Set up monitoring and alerting
- Document the deployment for team reference` :
  `### Preview Deployment Complete

If all tests passed, you can proceed with production deployment:

\`\`\`bash
npm run netlify:deploy:prod
\`\`\`

If tests failed, fix the issues and redeploy:

\`\`\`bash
npm run build
npm run netlify:deploy:preview
\`\`\`
`}

## Manual Testing Checklist

After automated validation, manually test these features:

- [ ] OAuth login flow (Google)
- [ ] User onboarding process
- [ ] Feed content loading (real articles, not mock data)
- [ ] Article interactions (star, mark as read)
- [ ] Settings page functionality
- [ ] Feed management (add/remove feeds)
- [ ] Responsive design on mobile devices
- [ ] Performance and loading times

## Troubleshooting

If issues are found:

1. **Check Netlify Dashboard:** https://app.netlify.com/sites/${deploymentInfo.url.split('//')[1].split('.')[0]}/overview
2. **View Function Logs:** \`netlify logs:functions\`
3. **Check Build Logs:** \`netlify logs:deploy\`
4. **Verify Environment Variables:** \`netlify env:list\`
5. **Test API Endpoints:** Use browser dev tools or Postman

## Support Resources

- **Netlify Documentation:** https://docs.netlify.com/
- **Supabase Documentation:** https://supabase.com/docs
- **Project Repository:** Check README.md for setup instructions
`;

  // Write report to file
  require('fs').writeFileSync(reportPath, report);
  console.log(`📄 Validation report saved to: ${reportPath}`);
}

async function main() {
  console.log('🚀 Cronkite Production Deployment and Validation\n');
  
  try {
    // Step 1: Check prerequisites
    const prereqResult = await checkPrerequisites();
    if (!prereqResult.success) {
      console.error(`❌ ${prereqResult.message}`);
      if (prereqResult.details) {
        console.error(`   ${prereqResult.details}`);
      }
      process.exit(1);
    }
    
    // Step 2: Build application
    const buildResult = await buildApplication();
    if (!buildResult.success) {
      console.error(`❌ ${buildResult.message}`);
      if (buildResult.details) {
        console.error(`   ${buildResult.details}`);
      }
      process.exit(1);
    }
    
    // Step 3: Choose deployment type
    const deployType = await question('\n🎯 Deployment type:\n  1. Preview deployment (recommended first)\n  2. Production deployment\nChoose (1 or 2): ');
    const isProduction = deployType.trim() === '2';
    
    if (isProduction) {
      const confirm = await question('\n⚠️  You are about to deploy to PRODUCTION. Are you sure? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('❌ Production deployment cancelled.');
        process.exit(0);
      }
    }
    
    // Step 4: Deploy to Netlify
    const deploymentInfo = await deployToNetlify(isProduction);
    if (!deploymentInfo) {
      console.error('❌ Deployment failed');
      process.exit(1);
    }
    
    // Step 5: Wait for deployment to be ready
    console.log('\n⏳ Waiting for deployment to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    
    // Step 6: Validate deployment
    const validationResults = await validateDeployment(deploymentInfo);
    
    // Step 7: Check function logs
    const functionLogsResult = await checkNetlifyFunctionLogs(deploymentInfo.deployId);
    
    // Step 8: Generate report
    await generateValidationReport(deploymentInfo, validationResults, functionLogsResult);
    
    // Step 9: Display summary
    console.log('\n📊 Validation Summary:');
    const allResults = [...validationResults, functionLogsResult];
    const passedCount = allResults.filter(r => r.success).length;
    const totalCount = allResults.length;
    
    console.log(`   Passed: ${passedCount}/${totalCount}`);
    console.log(`   Failed: ${totalCount - passedCount}/${totalCount}`);
    
    if (passedCount === totalCount) {
      console.log('\n🎉 All validations passed! Deployment is successful.');
      
      if (!isProduction) {
        console.log('\n🚀 Ready for production deployment!');
        console.log('   Run: npm run netlify:deploy:prod');
      } else {
        console.log('\n✅ Production deployment complete!');
        console.log(`   Your app is live at: ${deploymentInfo.url}`);
      }
    } else {
      console.log('\n⚠️  Some validations failed. Please review the issues above.');
      console.log('   Check the validation report for detailed information.');
    }
    
    // Step 10: Manual testing reminder
    console.log('\n📋 Don\'t forget to perform manual testing:');
    console.log('   • OAuth login flow');
    console.log('   • User onboarding');
    console.log('   • Feed functionality');
    console.log('   • Settings management');
    console.log('   • Mobile responsiveness');
    
  } catch (error: any) {
    console.error('❌ Deployment process failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n❌ Deployment cancelled by user.');
  rl.close();
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Deployment failed:', error);
    rl.close();
    process.exit(1);
  });
}