# Database and Category Management Scripts

This directory contains utility scripts for database management, seeding, and category mapping validation.

## Scripts Overview

### Database Seeding

#### `seed-database.ts`
Seeds the database with 105 feeds for development environment.

**Features:**
- Pre-seeding category mapping validation
- Category validation before insertion
- Rejection of feeds with unmapped categories
- Category distribution logging
- Coverage analysis

**Usage:**
```bash
npm run db:seed
# or with validation
npm run db:seed:validate
```

#### `seed-comprehensive.ts`
Seeds the database with 865 feeds for production environment.

**Features:**
- Generates feeds across all frontend categories
- Batch insertion for performance
- Comprehensive validation
- Balanced distribution across categories

**Usage:**
```bash
npm run db:seed:comprehensive
# or with validation
npm run db:seed:comprehensive:validate
```

### Database Status and Analysis

#### `database-status.ts`
Provides comprehensive database status report.

**Reports:**
- Database connection status
- Feed counts and statistics
- Category distribution with mapping validation
- Data integrity checks
- Environment detection
- Actionable recommendations

**Usage:**
```bash
npm run db:status
```

#### `check-database.ts`
Quick database content check with category mapping validation.

**Features:**
- Fast feed count and distribution
- Category mapping validation
- Environment detection
- Summary statistics

**Usage:**
```bash
npm run db:check
```

#### `category-distribution.ts`
Detailed category distribution analysis.

**Formats:**
- `detailed` - Full distribution table with statistics
- `summary` - Quick summary of top categories
- `csv` - Export data in CSV format

**Features:**
- Category coverage analysis
- Distribution balance analysis
- Underrepresented category detection
- Featured feed statistics
- Average popularity scores

**Usage:**
```bash
npm run category:distribution              # detailed
npm run category:distribution summary      # summary
npm run category:distribution csv          # CSV export
```

### Category Mapping Validation

#### `validate-category-mapping.ts`
Comprehensive category mapping validation utility.

**Commands:**
- `all` - Run all validations (default)
- `mapping` - Validate mapping completeness
- `frontend` - Validate frontend categories
- `table` - Show mapping table
- `seeded` - Validate seeded data coverage

**Features:**
- Bidirectional mapping validation
- Coverage completeness checks
- Database category validation
- Seeded data coverage analysis
- Detailed error and warning reporting

**Usage:**
```bash
npm run validate:categories                # all validations
npm run validate:categories:mapping        # mapping only
npm run validate:categories:frontend       # frontend only
npm run validate:categories:table          # show table
npm run validate:categories:seeded         # seeded data
```

#### `category-mapping-status.ts`
Category mapping system health and status reporting.

**Formats:**
- `detailed` - Full status report with all checks
- `summary` - Quick status summary
- `health` - Health check results
- `json` - Export status as JSON

**Features:**
- Mapping validation status
- Coverage analysis
- Database integration status
- Health score calculation
- Mapping table with usage indicators

**Usage:**
```bash
npm run category:mapping:status            # detailed
npm run category:mapping:status summary    # summary
npm run category:mapping:status health     # health check
npm run category:mapping:status json       # JSON export
```

## Script Dependencies

All scripts depend on:
- `shared/category-mapping.ts` - Category mapping service
- `server/env.ts` - Environment configuration
- Supabase client for database operations

## Environment Variables

Required environment variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

Optional:
- `NODE_ENV` - Environment (development/production)

## Error Handling

All scripts include comprehensive error handling:
- Clear error messages
- Actionable recommendations
- Validation before destructive operations
- Graceful degradation when database unavailable

## Integration with Category Mapping

All scripts integrate with the category mapping system to ensure:

1. **Validation**: Pre-flight checks before seeding
2. **Consistency**: All data uses valid, mapped categories
3. **Monitoring**: Real-time validation during operations
4. **Reporting**: Detailed status and health information

## Development Workflow

### Initial Setup
```bash
# 1. Validate mappings
npm run validate:categories:mapping

# 2. Seed development database
npm run db:seed:validate

# 3. Check status
npm run db:check
```

### Regular Development
```bash
# Quick status check
npm run db:check

# Detailed analysis when needed
npm run db:status
npm run category:distribution
```

### Troubleshooting
```bash
# Comprehensive health check
npm run category:mapping:status health

# Detailed validation
npm run validate:categories:all

# Distribution analysis
npm run category:distribution detailed
```

### Database Reset
```bash
# Development reset
npm run db:reset:dev

# Production reset
npm run db:reset:prod
```

## Output Formats

### Status Reports
All status scripts provide:
- ✅/❌ Status indicators
- 📊 Statistics and metrics
- 💡 Recommendations
- 🎉 Success messages
- ⚠️ Warnings

### Validation Results
Validation scripts show:
- Pass/fail status
- Error details
- Warning messages
- Coverage percentages
- Mapping statistics

### Distribution Analysis
Distribution scripts display:
- Category counts and percentages
- Featured feed counts
- Average popularity scores
- Balance metrics
- Coverage analysis

## Best Practices

1. **Always validate before seeding**: Use `db:seed:validate` or `db:seed:comprehensive:validate`
2. **Check status regularly**: Run `db:check` or `db:status` to monitor system health
3. **Analyze distribution**: Use `category:distribution` to ensure balanced coverage
4. **Monitor mapping health**: Run `category:mapping:status health` periodically
5. **Use appropriate environment**: 105 feeds for dev, 865 for production

## Troubleshooting Guide

### No feeds in database
```bash
npm run db:seed:validate
```

### Category mapping errors
```bash
npm run validate:categories:all
npm run category:mapping:status health
```

### Distribution imbalance
```bash
npm run category:distribution detailed
# Check for underrepresented categories
```

### Database connection issues
```bash
npm run db:status
# Check connection status and configuration
```

### Invalid categories in database
```bash
npm run validate:categories:seeded
# Identify and fix unmapped categories
```

## Script Maintenance

When adding new frontend categories:
1. Update `shared/category-mapping.ts`
2. Run `npm run validate:categories:mapping`
3. Update seeding scripts if needed
4. Re-seed database: `npm run db:reset:dev`
5. Verify: `npm run category:mapping:status health`

When modifying database schema:
1. Update migrations
2. Run `npm run supabase:migrate`
3. Re-seed: `npm run db:reset:dev`
4. Verify: `npm run db:status`