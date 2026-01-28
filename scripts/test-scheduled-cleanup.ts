#!/usr/bin/env tsx
/**
 * Test script for scheduled cleanup function
 * 
 * This script tests the scheduled cleanup function locally by directly
 * importing and invoking it, simulating what Netlify would do.
 */

import { config } from '../netlify/functions/scheduled-cleanup';

async function testScheduledCleanup() {
  console.log('🧪 Testing Scheduled Cleanup Function\n');
  
  // Step 1: Verify configuration
  console.log('Step 1: Verifying configuration...');
  console.log(`   Schedule: ${config.schedule}`);
  console.log(`   Expected: "0 2 * * *" (2 AM daily)`);
  
  if (config.schedule !== "0 2 * * *") {
    console.error('❌ Configuration mismatch!');
    process.exit(1);
  }
  console.log('✅ Configuration verified\n');
  
  // Step 2: Import the handler
  console.log('Step 2: Importing handler...');
  const handler = (await import('../netlify/functions/scheduled-cleanup')).default;
  console.log('✅ Handler imported\n');
  
  // Step 3: Invoke the handler
  console.log('Step 3: Invoking handler...');
  console.log('─'.repeat(60));
  
  const startTime = Date.now();
  const response = await handler();
  const duration = Date.now() - startTime;
  
  console.log('─'.repeat(60));
  console.log(`\n✅ Handler completed in ${duration}ms\n`);
  
  // Step 4: Parse and display results
  console.log('Step 4: Parsing results...');
  const body = await response.text();
  const result = JSON.parse(body);
  
  console.log('\n📊 Results:');
  console.log(`   Status: ${response.status}`);
  console.log(`   Success: ${result.success}`);
  
  if (result.success) {
    console.log(`   Users processed: ${result.results.usersProcessed}`);
    console.log(`   Articles deleted: ${result.results.articlesDeleted}`);
    console.log(`   Cleanup duration: ${result.results.cleanupDurationMs}ms`);
    console.log(`   Total duration: ${result.duration}ms`);
  } else {
    console.log(`   Error: ${result.error}`);
    if (result.stack) {
      console.log(`\n   Stack trace:`);
      console.log(result.stack.split('\n').map((line: string) => `   ${line}`).join('\n'));
    }
  }
  
  // Step 5: Summary
  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('✅ Scheduled cleanup function test PASSED');
  } else {
    console.log('❌ Scheduled cleanup function test FAILED');
    process.exit(1);
  }
  console.log('='.repeat(60));
}

// Run the test
testScheduledCleanup().catch((error) => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
