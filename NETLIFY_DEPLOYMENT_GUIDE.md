# Netlify Deployment Guide for Cronkite

This guide walks you through deploying Cronkite to Netlify with all required environment variables and production configuration.

## Prerequisites

- [x] Netlify CLI installed and authenticated
- [x] Project linked to Netlify site: `cronkite-v4`
- [x] Build script configured for Netlify deployment
- [x] netlify.toml configuration file present
- [ ] Supabase production project created
- [ ] Google OAuth credentials configured
- [ ] Production environment variables set

## Current Status

**Netlify Site Information:**
- **Site Name:** cronkite-v4
- **Project URL:** https://cronkite-v4.netlify.app
- **Admin URL:** https://app.netlify.com/projects/cronkite-v4
- **Project ID:** 13a2aff8-0ac0-4860-ad07-d8c8f91839e6

**Current Environment Variables:**
- `PUBLISH_DIR`: dist/public
- `NODE_VERSION`: 18
- `NPM_FLAGS`: --legacy-peer-deps

## Step 1: Set Up Supabase Production Project

Before deploying, you need to create a Supabase production project and get the credentials.

### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose your organization
4. Set project name: `cronkite-production`
5. Set database password (save this securely!)
6. Choose region closest to your users
7. Wait for project to be created

### 1.2 Get Supabase Credentials

Once your project is created:

1. Go to Project Settings → API
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`)

3. Go to Project Settings → Database
4. Copy the **Connection string** (URI format)
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

### 1.3 Run Database Migrations

Apply all database migrations to your production Supabase project:

```bash
# Set the production database URL temporarily
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# Run migrations using Supabase CLI
supabase db push --db-url "$DATABASE_URL"

# Or manually apply migrations from supabase/migrations/ directory
```

### 1.4 Seed Production Data

Seed the production database with recommended feeds:

```bash
# Run the production seed script
npm run db:seed:production:validate
```

## Step 2: Configure Google OAuth

### 2.1 Create Google OAuth Credentials

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Add authorized redirect URIs:
   - `https://cronkite-v4.netlify.app/auth/callback`
   - `https://[your-supabase-project].supabase.co/auth/v1/callback`
7. Save and copy:
   - **Client ID**
   - **Client Secret**

### 2.2 Configure Supabase OAuth

1. Go to your Supabase project → Authentication → Providers
2. Enable Google provider
3. Enter your Google Client ID and Client Secret
4. Save configuration

## Step 3: Generate Session Secret

Generate a secure session secret for production:

```bash
# Generate a random 64-character hex string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this value securely - you'll need it for the environment variables.

## Step 4: Set Netlify Environment Variables

Now we'll set all required environment variables in Netlify. You can do this via:
- **Option A:** Netlify CLI (recommended for bulk setup)
- **Option B:** Netlify Dashboard UI

### Option A: Using Netlify CLI

```bash
# Supabase Configuration
netlify env:set SUPABASE_URL "https://[your-project-ref].supabase.co"
netlify env:set SUPABASE_ANON_KEY "eyJ[your-anon-key]..."
netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJ[your-service-role-key]..."

# Database Configuration
netlify env:set DATABASE_URL "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Application Configuration
netlify env:set NODE_ENV "production"
netlify env:set APP_URL "https://cronkite-v4.netlify.app"
netlify env:set SESSION_SECRET "[your-generated-secret]"

# OAuth Configuration
netlify env:set GOOGLE_CLIENT_ID "[your-google-client-id]"
netlify env:set GOOGLE_CLIENT_SECRET "[your-google-client-secret]"

# RSS Sync Configuration
netlify env:set RSS_SYNC_INTERVAL "3600000"
netlify env:set RSS_SYNC_BATCH_SIZE "5"
netlify env:set RSS_SYNC_MAX_ARTICLES "100"
```

### Option B: Using Netlify Dashboard

1. Go to https://app.netlify.com/projects/cronkite-v4
2. Navigate to Site Settings → Environment Variables
3. Click "Add a variable" for each of the following:

**Supabase Configuration:**
- `SUPABASE_URL`: `https://[your-project-ref].supabase.co`
- `SUPABASE_ANON_KEY`: `eyJ[your-anon-key]...`
- `SUPABASE_SERVICE_ROLE_KEY`: `eyJ[your-service-role-key]...` (mark as sensitive)

**Database Configuration:**
- `DATABASE_URL`: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres` (mark as sensitive)

**Application Configuration:**
- `NODE_ENV`: `production`
- `APP_URL`: `https://cronkite-v4.netlify.app`
- `SESSION_SECRET`: `[your-generated-secret]` (mark as sensitive)

**OAuth Configuration:**
- `GOOGLE_CLIENT_ID`: `[your-google-client-id]`
- `GOOGLE_CLIENT_SECRET`: `[your-google-client-secret]` (mark as sensitive)

**RSS Sync Configuration:**
- `RSS_SYNC_INTERVAL`: `3600000`
- `RSS_SYNC_BATCH_SIZE`: `5`
- `RSS_SYNC_MAX_ARTICLES`: `100`

## Step 5: Verify Environment Variables

After setting all variables, verify they're configured correctly:

```bash
netlify env:list
```

You should see all the variables listed above.

## Step 6: Build and Test Locally

Before deploying to production, test the build locally:

```bash
# Install dependencies
npm install

# Run the build
npm run build

# Verify build artifacts
ls -la dist/public/     # Should contain frontend assets
ls -la dist/functions/  # Should contain api.js
```

## Step 7: Deploy to Netlify

### 7.1 Preview Deploy (Recommended First)

Create a preview deployment to test everything:

```bash
netlify deploy
```

This will:
1. Build your application
2. Deploy to a preview URL
3. Show you the preview URL to test

**Test the preview deployment:**
- Visit the preview URL
- Test OAuth login flow
- Verify feed content loads
- Check that all features work

### 7.2 Production Deploy

Once you've verified the preview works correctly:

```bash
netlify deploy --prod
```

This will deploy to your production URL: https://cronkite-v4.netlify.app

## Step 8: Post-Deployment Validation

After deployment, verify everything works:

### 8.1 Basic Checks
- [ ] Site loads at https://cronkite-v4.netlify.app
- [ ] No console errors in browser
- [ ] All routes work (no 404s)
- [ ] API endpoints respond correctly

### 8.2 OAuth Flow
- [ ] Click "Sign In" button
- [ ] Redirects to Google OAuth
- [ ] After authorization, redirects back to app
- [ ] User profile is created in database
- [ ] Session persists across page reloads

### 8.3 Feed Functionality
- [ ] New users see onboarding flow
- [ ] Onboarding saves preferences
- [ ] Main feed displays real articles (not mock data)
- [ ] Articles can be starred/marked as read
- [ ] Feed filtering works correctly

### 8.4 Settings Page
- [ ] Can add custom RSS feeds
- [ ] Can remove feeds
- [ ] Preferences update correctly
- [ ] Changes reflect in main feed

### 8.5 RSS Sync
- [ ] Check Netlify function logs for sync activity
- [ ] Verify articles are being fetched from RSS feeds
- [ ] Check database for new articles

## Troubleshooting

### Build Fails

Check Netlify build logs:
```bash
netlify logs:deploy
```

Common issues:
- Missing environment variables
- TypeScript errors
- Dependency installation failures

### OAuth Not Working

1. Verify Google OAuth redirect URIs match exactly
2. Check Supabase OAuth configuration
3. Verify `APP_URL` environment variable is correct
4. Check browser console for errors

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Check Supabase project is running
3. Verify database password is correct
4. Check network connectivity from Netlify

### Feed Sync Not Working

1. Check Netlify function logs
2. Verify RSS feed URLs are accessible
3. Check database for sync errors
4. Verify `RSS_SYNC_*` environment variables

## Monitoring

### Netlify Dashboard

Monitor your deployment:
- **Functions:** https://app.netlify.com/sites/cronkite-v4/functions
- **Logs:** https://app.netlify.com/sites/cronkite-v4/logs
- **Analytics:** https://app.netlify.com/sites/cronkite-v4/analytics

### Supabase Dashboard

Monitor your database:
- **Database:** https://supabase.com/dashboard/project/[project-ref]/database/tables
- **Auth:** https://supabase.com/dashboard/project/[project-ref]/auth/users
- **Logs:** https://supabase.com/dashboard/project/[project-ref]/logs/explorer

## Security Checklist

- [ ] All secrets marked as sensitive in Netlify
- [ ] Session secret is randomly generated (not default)
- [ ] Database password is strong
- [ ] OAuth credentials are from production Google project
- [ ] No secrets committed to git
- [ ] HTTPS enforced (automatic with Netlify)
- [ ] Security headers configured in netlify.toml

## Next Steps

After successful deployment:

1. **Set up monitoring:** Configure alerts for errors and downtime
2. **Configure custom domain:** (Optional) Add your own domain
3. **Enable analytics:** Track usage and performance
4. **Set up backups:** Configure Supabase backup schedule
5. **Document credentials:** Store all credentials securely (1Password, etc.)

## Support

If you encounter issues:
- Check Netlify documentation: https://docs.netlify.com/
- Check Supabase documentation: https://supabase.com/docs
- Review build logs and function logs
- Check browser console for client-side errors
