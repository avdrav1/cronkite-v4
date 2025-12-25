/**
 * Script to set admin role for a user
 * Usage: npx tsx scripts/set-admin-user.ts [email]
 * Default: av@lab828.com
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const ADMIN_EMAIL = process.argv[2] || 'av@lab828.com';

async function setAdminUser() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('Make sure your .env.local or .env file has these variables set.');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log(`🔐 Setting admin role for: ${ADMIN_EMAIL}`);
  console.log(`📍 Database: ${supabaseUrl}`);
  
  // First check if user exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('profiles')
    .select('id, email, is_admin')
    .eq('email', ADMIN_EMAIL)
    .single();
  
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Error fetching user:', fetchError.message);
    process.exit(1);
  }
  
  if (!existingUser) {
    console.log(`⚠️  User ${ADMIN_EMAIL} not found in profiles table.`);
    console.log('   The user needs to register/login first before being granted admin.');
    process.exit(1);
  }
  
  if (existingUser.is_admin) {
    console.log(`✅ User ${ADMIN_EMAIL} is already an admin.`);
    return;
  }
  
  // Update user to admin
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('email', ADMIN_EMAIL);
  
  if (updateError) {
    console.error('❌ Error updating user:', updateError.message);
    process.exit(1);
  }
  
  console.log(`✅ Successfully granted admin role to ${ADMIN_EMAIL}`);
}

setAdminUser().catch(console.error);
