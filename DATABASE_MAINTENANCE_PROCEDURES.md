# Database Backup and Maintenance Procedures

## Overview

This document outlines the backup strategies, maintenance procedures, and operational guidelines for the Cronkite database system.

## Backup Procedures

### 1. Automated Daily Backups

#### Full Database Backup Script
```bash
#!/bin/bash
# daily_backup.sh

# Configuration
DB_HOST="localhost"
DB_PORT="54322"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_DIR="/var/backups/cronkite"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Full database backup
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --format=custom --compress=9 --verbose \
  --file="$BACKUP_DIR/cronkite_full_$TIMESTAMP.dump"

# Schema-only backup
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --schema-only --format=plain --verbose \
  --file="$BACKUP_DIR/cronkite_schema_$TIMESTAMP.sql"

# Data-only backup (excluding large tables)
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --data-only --format=custom --compress=9 \
  --exclude-table=articles --exclude-table=feed_sync_log \
  --file="$BACKUP_DIR/cronkite_userdata_$TIMESTAMP.dump"

# Clean up old backups
find "$BACKUP_DIR" -name "cronkite_*.dump" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "cronkite_*.sql" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $TIMESTAMP"
```

#### Cron Job Setup
```bash
# Add to crontab (crontab -e)
# Daily backup at 2 AM
0 2 * * * /path/to/daily_backup.sh >> /var/log/cronkite_backup.log 2>&1

# Weekly full backup at 1 AM on Sundays
0 1 * * 0 /path/to/weekly_backup.sh >> /var/log/cronkite_backup.log 2>&1
```

### 2. Selective Backup Strategies

#### User Data Backup
```bash
#!/bin/bash
# backup_user_data.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

pg_dump -h localhost -p 54322 -U postgres -d postgres \
  --format=custom --compress=9 \
  --table=profiles --table=user_settings --table=user_interests \
  --table=folders --table=feeds --table=user_articles \
  --table=ai_usage --table=digest_history \
  --file="cronkite_userdata_$TIMESTAMP.dump"
```

#### Content Backup (Articles and Clusters)
```bash
#!/bin/bash
# backup_content.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

pg_dump -h localhost -p 54322 -U postgres -d postgres \
  --format=custom --compress=9 \
  --table=articles --table=clusters --table=recommended_feeds \
  --file="cronkite_content_$TIMESTAMP.dump"
```

### 3. Restore Procedures

#### Full Database Restore
```bash
#!/bin/bash
# restore_full.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.dump>"
    exit 1
fi

# Drop existing database (CAUTION!)
dropdb -h localhost -p 54322 -U postgres postgres

# Create new database
createdb -h localhost -p 54322 -U postgres postgres

# Restore from backup
pg_restore -h localhost -p 54322 -U postgres -d postgres \
  --verbose --clean --no-acl --no-owner \
  "$BACKUP_FILE"

echo "Database restored from: $BACKUP_FILE"
```

#### Selective Restore
```bash
#!/bin/bash
# restore_selective.sh

BACKUP_FILE="$1"
TABLE_NAME="$2"

if [ -z "$BACKUP_FILE" ] || [ -z "$TABLE_NAME" ]; then
    echo "Usage: $0 <backup_file.dump> <table_name>"
    exit 1
fi

pg_restore -h localhost -p 54322 -U postgres -d postgres \
  --verbose --clean --no-acl --no-owner \
  --table="$TABLE_NAME" \
  "$BACKUP_FILE"
```

## Maintenance Procedures

### 1. Daily Maintenance Tasks

#### Automated Daily Maintenance Script
```sql
-- daily_maintenance.sql

-- Update table statistics for query optimization
ANALYZE;

-- Clean up expired clusters
DELETE FROM clusters WHERE expires_at < NOW() - INTERVAL '1 day';

-- Clean up old digest history (keep 90 days)
DELETE FROM digest_history WHERE created_at < NOW() - INTERVAL '90 days';

-- Clean up old AI usage records (keep 1 year)
DELETE FROM ai_usage WHERE created_at < NOW() - INTERVAL '1 year';

-- Update feed article counts
UPDATE feeds SET article_count = (
    SELECT COUNT(*) FROM articles WHERE feed_id = feeds.id
) WHERE article_count != (
    SELECT COUNT(*) FROM articles WHERE feed_id = feeds.id
);

-- Update cluster article counts
UPDATE clusters SET article_count = (
    SELECT COUNT(*) FROM articles WHERE cluster_id = clusters.id
) WHERE article_count != (
    SELECT COUNT(*) FROM articles WHERE cluster_id = clusters.id
);

-- Log maintenance completion
INSERT INTO maintenance_log (task_name, completed_at, status)
VALUES ('daily_maintenance', NOW(), 'completed');
```

#### Maintenance Log Table
```sql
CREATE TABLE IF NOT EXISTS maintenance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name TEXT NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'completed',
    details JSONB,
    duration_ms INTEGER
);
```

### 2. Weekly Maintenance Tasks

#### Weekly Maintenance Script
```sql
-- weekly_maintenance.sql

-- Vacuum analyze all tables
VACUUM ANALYZE;

-- Reindex tables with high update frequency
REINDEX TABLE user_articles;
REINDEX TABLE feed_sync_log;
REINDEX TABLE ai_usage;

-- Check for unused indexes
SELECT 
    schemaname, tablename, indexname, 
    idx_tup_read, idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexname)) as size
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 
AND schemaname = 'public'
ORDER BY pg_relation_size(indexname) DESC;

-- Check table bloat
SELECT 
    schemaname, tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Log weekly maintenance
INSERT INTO maintenance_log (task_name, completed_at, status)
VALUES ('weekly_maintenance', NOW(), 'completed');
```

### 3. Monthly Maintenance Tasks

#### Monthly Deep Maintenance
```sql
-- monthly_maintenance.sql

-- Full vacuum for space reclamation (during maintenance window)
-- VACUUM FULL; -- Uncomment during scheduled maintenance

-- Update all table statistics
ANALYZE;

-- Check for fragmented indexes
SELECT 
    schemaname, tablename, indexname,
    pg_size_pretty(pg_relation_size(indexname)) as size,
    idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname) DESC;

-- Archive old articles (older than 1 year)
-- Create archive table if needed
CREATE TABLE IF NOT EXISTS articles_archive (LIKE articles INCLUDING ALL);

-- Move old articles to archive
WITH old_articles AS (
    DELETE FROM articles 
    WHERE published_at < NOW() - INTERVAL '1 year'
    AND id NOT IN (
        SELECT article_id FROM user_articles 
        WHERE is_starred = TRUE
    )
    RETURNING *
)
INSERT INTO articles_archive SELECT * FROM old_articles;

-- Clean up orphaned user_articles
DELETE FROM user_articles 
WHERE article_id NOT IN (SELECT id FROM articles);

-- Log monthly maintenance
INSERT INTO maintenance_log (task_name, completed_at, status, details)
VALUES ('monthly_maintenance', NOW(), 'completed', 
    jsonb_build_object('archived_articles', 
        (SELECT COUNT(*) FROM articles_archive WHERE created_at > NOW() - INTERVAL '1 day')
    )
);
```

## Monitoring and Alerting

### 1. Database Health Monitoring

#### Health Check Script
```sql
-- health_check.sql

-- Database size and growth
SELECT 
    'database_size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    pg_database_size(current_database()) as bytes;

-- Table sizes
SELECT 
    'table_size' as metric,
    tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Connection count
SELECT 
    'connections' as metric,
    state,
    COUNT(*) as count
FROM pg_stat_activity 
WHERE datname = current_database()
GROUP BY state;

-- Long running queries
SELECT 
    'long_queries' as metric,
    query,
    state,
    now() - query_start as duration
FROM pg_stat_activity 
WHERE datname = current_database()
AND state != 'idle'
AND now() - query_start > INTERVAL '5 minutes';

-- Index usage efficiency
SELECT 
    'index_usage' as metric,
    schemaname, tablename, indexname,
    idx_tup_read, idx_tup_fetch,
    CASE WHEN idx_tup_read > 0 
         THEN round((idx_tup_fetch::numeric / idx_tup_read) * 100, 2)
         ELSE 0 
    END as efficiency_percent
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
AND idx_tup_read > 1000
ORDER BY efficiency_percent ASC;
```

### 2. Performance Monitoring

#### Slow Query Detection
```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Query to find slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 100  -- Queries taking more than 100ms on average
ORDER BY mean_time DESC 
LIMIT 20;
```

#### Lock Monitoring
```sql
-- Check for blocking queries
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```

### 3. Alerting Thresholds

#### Database Size Alerts
```bash
#!/bin/bash
# check_db_size.sh

DB_SIZE_BYTES=$(psql -h localhost -p 54322 -U postgres -d postgres -t -c "SELECT pg_database_size(current_database());")
DB_SIZE_GB=$((DB_SIZE_BYTES / 1024 / 1024 / 1024))

# Alert if database size exceeds 10GB
if [ $DB_SIZE_GB -gt 10 ]; then
    echo "ALERT: Database size is ${DB_SIZE_GB}GB, exceeding 10GB threshold"
    # Send alert (email, Slack, etc.)
fi
```

#### Connection Count Alerts
```bash
#!/bin/bash
# check_connections.sh

ACTIVE_CONNECTIONS=$(psql -h localhost -p 54322 -U postgres -d postgres -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' AND datname = current_database();")

# Alert if active connections exceed 50
if [ $ACTIVE_CONNECTIONS -gt 50 ]; then
    echo "ALERT: Active connections: $ACTIVE_CONNECTIONS, exceeding threshold of 50"
    # Send alert
fi
```

## Disaster Recovery

### 1. Recovery Planning

#### Recovery Time Objectives (RTO)
- **Critical Systems**: 1 hour
- **User Data**: 4 hours
- **Full System**: 24 hours

#### Recovery Point Objectives (RPO)
- **User Data**: 1 hour (continuous replication)
- **Content Data**: 24 hours (daily backups)
- **System Configuration**: 1 week (weekly backups)

### 2. Recovery Procedures

#### Point-in-Time Recovery
```bash
#!/bin/bash
# point_in_time_recovery.sh

TARGET_TIME="$1"  # Format: 2024-01-15 14:30:00

if [ -z "$TARGET_TIME" ]; then
    echo "Usage: $0 'YYYY-MM-DD HH:MM:SS'"
    exit 1
fi

# Stop database
sudo systemctl stop postgresql

# Restore from base backup
pg_basebackup -h backup-server -D /var/lib/postgresql/data -U postgres -v -P -W

# Configure recovery
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
EOF

# Start database
sudo systemctl start postgresql

echo "Point-in-time recovery initiated to: $TARGET_TIME"
```

#### Data Corruption Recovery
```sql
-- Check for data corruption
SELECT 
    schemaname, tablename,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_relation_size(schemaname||'.'||tablename) DESC;

-- Verify table integrity
VACUUM ANALYZE;

-- Check for constraint violations
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    contype as constraint_type
FROM pg_constraint 
WHERE NOT convalidated;

-- Rebuild corrupted indexes
REINDEX DATABASE postgres;
```

### 3. Testing Recovery Procedures

#### Monthly Recovery Test
```bash
#!/bin/bash
# test_recovery.sh

# Create test environment
createdb -h localhost -p 54322 -U postgres cronkite_recovery_test

# Restore latest backup
LATEST_BACKUP=$(ls -t /var/backups/cronkite/cronkite_full_*.dump | head -1)
pg_restore -h localhost -p 54322 -U postgres -d cronkite_recovery_test \
  --verbose --clean --no-acl --no-owner \
  "$LATEST_BACKUP"

# Verify data integrity
psql -h localhost -p 54322 -U postgres -d cronkite_recovery_test -c "
SELECT 
    'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT 'feeds', COUNT(*) FROM feeds
UNION ALL  
SELECT 'articles', COUNT(*) FROM articles
UNION ALL
SELECT 'user_articles', COUNT(*) FROM user_articles;
"

# Clean up test database
dropdb -h localhost -p 54322 -U postgres cronkite_recovery_test

echo "Recovery test completed successfully"
```

## Security Considerations

### 1. Backup Security

#### Encryption at Rest
```bash
# Encrypt backup files
gpg --cipher-algo AES256 --compress-algo 1 --s2k-cipher-algo AES256 \
    --s2k-digest-algo SHA512 --s2k-mode 3 --s2k-count 65536 \
    --symmetric --output cronkite_backup_encrypted.gpg \
    cronkite_backup.dump

# Decrypt backup files
gpg --decrypt cronkite_backup_encrypted.gpg > cronkite_backup.dump
```

#### Secure Transfer
```bash
# Transfer backups securely
rsync -avz --progress -e "ssh -i /path/to/key" \
    /var/backups/cronkite/ \
    backup-server:/secure/backups/cronkite/
```

### 2. Access Control

#### Database User Roles
```sql
-- Create backup user with minimal privileges
CREATE ROLE backup_user WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE postgres TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;

-- Create maintenance user
CREATE ROLE maintenance_user WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE postgres TO maintenance_user;
GRANT USAGE ON SCHEMA public TO maintenance_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO maintenance_user;
```

#### Audit Logging
```sql
-- Enable audit logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_duration = 'on';
SELECT pg_reload_conf();
```

---

This comprehensive maintenance and backup strategy ensures the Cronkite database remains healthy, secure, and recoverable in case of any issues.