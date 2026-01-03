# Database Scripts Documentation

This document describes the npm scripts available for database operations, seeding, and category mapping validation.

## Database Seeding Scripts

### Basic Seeding
- **`npm run db:seed`** - Seed database with 105 feeds (development environment)
- **`npm run db:seed:comprehensive`** - Seed database with 865 feeds (production environment)

### Validated Seeding (Recommended)
- **`npm run db:seed:validate`** - Validate category mappings then seed with 105 feeds
- **`npm run db:seed:comprehensive:validate`** - Validate category mappings then seed with 865 feeds

### Database Reset and Seeding
- **`npm run db:reset:dev`** - Reset database and seed with 105 feeds (with validation)
- **`npm run db:reset:prod`** - Reset database and seed with 865 feeds (with validation)

## Database Status and Checking Scripts

### Quick Status Checks
- **`npm run db:check`** - Quick database content check with category mapping validation
- **`npm run db:status`** - Comprehensive database status report including:
  - Connection status
  - Feed counts and distribution
  - Category mapping validation
  - Data integrity checks
  - Environment detection
  - Recommendations

### Category Analysis
- **`npm run category:distribution`** - Detailed category distribution analysis
- **`npm run category:distribution summary`** - Summary of category distribution
- **`npm run category:distribution csv`** - Export distribution data as CSV

### Category Mapping Status
- **`npm run category:mapping:status`** - Comprehensive category mapping status
- **`npm run category:mapping:status summary`** - Summary of mapping status
- **`npm run category:mapping:status health`** - Health check for mapping system
- **`npm run category:mapping:status json`** - Export status as JSON

## Category Validation Scripts

### Comprehensive Validation
- **`npm run validate:categories`** - Run all category validations (default)
- **`npm run validate:categories:all`** - Same as above, explicit all validations

### Specific Validations
- **`npm run validate:categories:mapping`** - Validate mapping completeness only
- **`npm run validate:categories:frontend`** - Validate frontend categories only
- **`npm run validate:categories:table`** - Show mapping table
- **`npm run validate:categories:seeded`** - Validate seeded data coverage

## Supabase Management Scripts

- **`npm run supabase:start`** - Start local Supabase instance
- **`npm run supabase:stop`** - Stop local Supabase instance
- **`npm run supabase:status`** - Show Supabase status
- **`npm run supabase:reset`** - Reset Supabase database
- **`npm run supabase:migrate`** - Push database migrations

## Recommended Workflows

### Development Setup
```bash
# 1. Start Supabase
npm run supabase:start

# 2. Validate category mappings
npm run validate:categories:mapping

# 3. Seed development database
npm run db:seed:validate

# 4. Check status
npm run db:check
```

### Production Setup
```bash
# 1. Validate category mappings
npm run validate:categories:all

# 2. Seed production database
npm run db:seed:comprehensive:validate

# 3. Verify status
npm run db:status
```

### Troubleshooting
```bash
# Check overall system health
npm run db:status

# Analyze category distribution
npm run category:distribution

# Check mapping status
npm run category:mapping:status health

# Validate all mappings
npm run validate:categories:all
```

### Database Reset (Development)
```bash
# Quick reset for development
npm run db:reset:dev

# Or step by step:
npm run supabase:reset
npm run validate:categories:mapping
npm run db:seed:validate
```

## Script Features

### Category Mapping Validation
All seeding scripts now include:
- ✅ Pre-seeding category mapping validation
- ✅ Category validation before database insertion
- ✅ Rejection of feeds with unmapped categories
- ✅ Category distribution logging
- ✅ Coverage analysis for frontend categories

### Enhanced Error Handling
- Clear error messages with actionable recommendations
- Validation failures prevent seeding to maintain data integrity
- Comprehensive logging for debugging

### Environment Detection
Scripts automatically detect environment based on feed count:
- **Minimal/Test**: ≤20 feeds
- **Development**: ≤150 feeds (~105 target)
- **Production**: ≥800 feeds (~865 target)
- **Custom**: Other counts

### Data Integrity Checks
- Missing required fields detection
- Invalid category detection
- Mapping consistency validation
- Coverage completeness analysis

## Output Examples

### Database Status
```
============================================================
  Database Status Report
============================================================

Database Connection: ✅ OK
Total feeds: 865
Environment: Production (865 feeds)
Category mapping: ✅ All valid
Data integrity: ✅ No issues found
```

### Category Distribution
```
📊 Feeds by category:
   ✅ Technology      (tech        ):  31 feeds (3.6%) [4 featured]
   ✅ Business        (business    ):  31 feeds (3.6%) [5 featured]
   ✅ Gaming          (gaming      ):  31 feeds (3.6%) [3 featured]
```

### Validation Results
```
Status: ✅ PASSED
Total mappings: 28
Frontend categories: 28
Database categories: 28
Coverage: 100.0%
```

## Error Handling

### Common Issues and Solutions

**Missing Supabase Configuration**
```
❌ Missing Supabase configuration
   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
```

**Category Mapping Errors**
```
❌ Category mapping validation failed. Missing mappings for: ['new-category']
   Add mapping in shared/category-mapping.ts
```

**Database Connection Issues**
```
❌ Database connection failed
   Check Supabase configuration and network connectivity
```

**Invalid Categories in Seeded Data**
```
❌ Found feeds with invalid categories:
   - Example Feed (category: InvalidCategory)
   Fix category names or add mappings before seeding
```

## Integration with Development Workflow

These scripts integrate with the category mapping system to ensure:
1. **Consistency**: All seeded data uses valid, mapped categories
2. **Validation**: Pre-flight checks prevent invalid data insertion
3. **Monitoring**: Comprehensive status reporting for system health
4. **Debugging**: Detailed analysis tools for troubleshooting issues

The scripts support both development (105 feeds) and production (865 feeds) environments while maintaining the same category mapping validation and data integrity standards.