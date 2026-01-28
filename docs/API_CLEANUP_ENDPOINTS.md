# API Documentation: Cleanup Endpoints

## Overview

This document describes the API endpoints for managing article cleanup settings and monitoring cleanup operations.

## User Endpoints

### Get Cleanup Settings

Retrieve the current user's cleanup settings.

**Endpoint:** `GET /api/users/cleanup-settings`

**Authentication:** Required

**Request:**
```http
GET /api/users/cleanup-settings HTTP/1.1
Host: api.cronkite.app
Cookie: connect.sid=<session-cookie>
```

**Response:**
```json
{
  "settings": {
    "articles_per_feed": 100,
    "unread_article_age_days": 30,
    "enable_auto_cleanup": true
  }
}
```

**Response Fields:**
- `articles_per_feed` (number): Maximum articles to keep per feed (50-500)
- `unread_article_age_days` (number): Maximum age in days for unread articles (7-90)
- `enable_auto_cleanup` (boolean): Whether automatic cleanup is enabled

**Status Codes:**
- `200 OK`: Settings retrieved successfully
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Server error occurred

**Example (curl):**
```bash
curl -X GET https://api.cronkite.app/api/users/cleanup-settings \
  -H "Cookie: connect.sid=<session-cookie>"
```

**Example (JavaScript):**
```javascript
const response = await fetch('/api/users/cleanup-settings', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();
console.log(data.settings);
```

---

### Update Cleanup Settings

Update the current user's cleanup settings.

**Endpoint:** `PUT /api/users/cleanup-settings`

**Authentication:** Required

**Request:**
```http
PUT /api/users/cleanup-settings HTTP/1.1
Host: api.cronkite.app
Cookie: connect.sid=<session-cookie>
Content-Type: application/json

{
  "articles_per_feed": 150,
  "unread_article_age_days": 45,
  "enable_auto_cleanup": true
}
```

**Request Body:**
All fields are optional. Only include fields you want to update.

- `articles_per_feed` (number, optional): Maximum articles per feed
  - Minimum: 50
  - Maximum: 500
  - Default: 100
- `unread_article_age_days` (number, optional): Maximum age for unread articles
  - Minimum: 7
  - Maximum: 90
  - Default: 30
- `enable_auto_cleanup` (boolean, optional): Enable/disable automatic cleanup
  - Default: true

**Response:**
```json
{
  "settings": {
    "articles_per_feed": 150,
    "unread_article_age_days": 45,
    "enable_auto_cleanup": true
  }
}
```

**Error Response (Validation):**
```json
{
  "error": "Validation error",
  "message": "Invalid cleanup settings",
  "details": [
    {
      "code": "too_small",
      "minimum": 50,
      "path": ["articles_per_feed"],
      "message": "Articles per feed must be at least 50"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Settings updated successfully
- `400 Bad Request`: Validation error (invalid values)
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Server error occurred

**Example (curl):**
```bash
curl -X PUT https://api.cronkite.app/api/users/cleanup-settings \
  -H "Cookie: connect.sid=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{
    "articles_per_feed": 150,
    "unread_article_age_days": 45
  }'
```

**Example (JavaScript):**
```javascript
const response = await fetch('/api/users/cleanup-settings', {
  method: 'PUT',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    articles_per_feed: 150,
    unread_article_age_days: 45,
    enable_auto_cleanup: true
  })
});

const data = await response.json();
console.log(data.settings);
```

---

## Admin Endpoints

### Get Cleanup Statistics

Retrieve aggregate statistics about cleanup operations.

**Endpoint:** `GET /api/admin/cleanup-stats`

**Authentication:** Required (Admin only)

**Request:**
```http
GET /api/admin/cleanup-stats HTTP/1.1
Host: api.cronkite.app
Cookie: connect.sid=<session-cookie>
```

**Response:**
```json
{
  "stats": {
    "totalCleanups": 1250,
    "totalArticlesDeleted": 45000,
    "averageDuration": 1234,
    "errorRate": 0.02,
    "last24Hours": {
      "cleanups": 50,
      "articlesDeleted": 1800,
      "errors": 1
    },
    "byTriggerType": {
      "sync": {
        "count": 800,
        "articlesDeleted": 30000
      },
      "scheduled": {
        "count": 400,
        "articlesDeleted": 14000
      },
      "manual": {
        "count": 50,
        "articlesDeleted": 1000
      }
    }
  }
}
```

**Response Fields:**
- `totalCleanups` (number): Total number of cleanup operations
- `totalArticlesDeleted` (number): Total articles deleted across all cleanups
- `averageDuration` (number): Average cleanup duration in milliseconds
- `errorRate` (number): Percentage of cleanups that failed (0-1)
- `last24Hours` (object): Statistics for the last 24 hours
  - `cleanups` (number): Number of cleanups in last 24 hours
  - `articlesDeleted` (number): Articles deleted in last 24 hours
  - `errors` (number): Failed cleanups in last 24 hours
- `byTriggerType` (object): Statistics grouped by trigger type
  - `sync` (object): Cleanups triggered by feed sync
  - `scheduled` (object): Cleanups triggered by scheduled job
  - `manual` (object): Cleanups triggered manually

**Status Codes:**
- `200 OK`: Statistics retrieved successfully
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not an admin
- `500 Internal Server Error`: Server error occurred

**Example (curl):**
```bash
curl -X GET https://api.cronkite.app/api/admin/cleanup-stats \
  -H "Cookie: connect.sid=<session-cookie>"
```

**Example (JavaScript):**
```javascript
const response = await fetch('/api/admin/cleanup-stats', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();
console.log(data.stats);
```

---

### Get Cleanup Logs

Retrieve paginated cleanup logs with optional filtering.

**Endpoint:** `GET /api/admin/cleanup-logs`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50, max: 100)
- `userId` (string, optional): Filter by user ID (UUID)
- `triggerType` (string, optional): Filter by trigger type ('sync', 'scheduled', 'manual')
- `hasError` (boolean, optional): Filter by error status (true/false)

**Request:**
```http
GET /api/admin/cleanup-logs?page=1&limit=50&triggerType=scheduled HTTP/1.1
Host: api.cronkite.app
Cookie: connect.sid=<session-cookie>
```

**Response:**
```json
{
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "feedId": "789e0123-e89b-12d3-a456-426614174000",
      "triggerType": "scheduled",
      "articlesDeleted": 25,
      "durationMs": 1234,
      "errorMessage": null,
      "createdAt": "2026-01-28T10:30:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "feedId": "889e0123-e89b-12d3-a456-426614174001",
      "triggerType": "sync",
      "articlesDeleted": 15,
      "durationMs": 987,
      "errorMessage": null,
      "createdAt": "2026-01-28T09:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "totalPages": 25
  }
}
```

**Response Fields:**

**Log Entry:**
- `id` (string): Unique log entry ID (UUID)
- `userId` (string): User ID who owns the articles (UUID)
- `feedId` (string|null): Feed ID that was cleaned up (null for user-wide cleanup)
- `triggerType` (string): How cleanup was triggered ('sync', 'scheduled', 'manual')
- `articlesDeleted` (number): Number of articles deleted
- `durationMs` (number): Cleanup duration in milliseconds
- `errorMessage` (string|null): Error message if cleanup failed
- `createdAt` (string): ISO 8601 timestamp of cleanup operation

**Pagination:**
- `page` (number): Current page number
- `limit` (number): Items per page
- `total` (number): Total number of log entries
- `totalPages` (number): Total number of pages

**Status Codes:**
- `200 OK`: Logs retrieved successfully
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not an admin
- `500 Internal Server Error`: Server error occurred

**Example (curl):**
```bash
# Get first page of all logs
curl -X GET https://api.cronkite.app/api/admin/cleanup-logs \
  -H "Cookie: connect.sid=<session-cookie>"

# Get logs for specific user
curl -X GET "https://api.cronkite.app/api/admin/cleanup-logs?userId=123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=<session-cookie>"

# Get only failed cleanups
curl -X GET "https://api.cronkite.app/api/admin/cleanup-logs?hasError=true" \
  -H "Cookie: connect.sid=<session-cookie>"

# Get scheduled cleanups with pagination
curl -X GET "https://api.cronkite.app/api/admin/cleanup-logs?triggerType=scheduled&page=2&limit=25" \
  -H "Cookie: connect.sid=<session-cookie>"
```

**Example (JavaScript):**
```javascript
// Get all logs
const response = await fetch('/api/admin/cleanup-logs', {
  method: 'GET',
  credentials: 'include'
});

// Get logs with filters
const params = new URLSearchParams({
  page: '1',
  limit: '50',
  triggerType: 'scheduled',
  hasError: 'false'
});

const response = await fetch(`/api/admin/cleanup-logs?${params}`, {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();
console.log(data.logs);
console.log(data.pagination);
```

---

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": {} // Optional additional details
}
```

### Common Error Responses

**401 Unauthorized:**
```json
{
  "error": "Authentication required",
  "message": "You must be logged in to access this resource"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Admin access required"
}
```

**400 Bad Request (Validation):**
```json
{
  "error": "Validation error",
  "message": "Invalid cleanup settings",
  "details": [
    {
      "code": "too_small",
      "minimum": 50,
      "path": ["articles_per_feed"],
      "message": "Articles per feed must be at least 50"
    }
  ]
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to update cleanup settings",
  "message": "An error occurred while updating cleanup settings"
}
```

---

## Rate Limiting

Currently, no rate limiting is applied to these endpoints. However, best practices:

- **User endpoints**: Can be called frequently (e.g., on settings page load/save)
- **Admin endpoints**: Should be called judiciously (e.g., dashboard refresh every 30-60 seconds)

---

## Authentication

All endpoints require authentication via session cookie:

1. User must be logged in
2. Session cookie (`connect.sid`) must be included in requests
3. Admin endpoints additionally require `is_admin: true` on user profile

**Session Cookie Example:**
```http
Cookie: connect.sid=s%3A<session-id>.<signature>
```

---

## Integration Examples

### React Component (User Settings)

```typescript
import { useState, useEffect } from 'react';

interface CleanupSettings {
  articles_per_feed: number;
  unread_article_age_days: number;
  enable_auto_cleanup: boolean;
}

export function CleanupSettingsForm() {
  const [settings, setSettings] = useState<CleanupSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load current settings
    fetch('/api/users/cleanup-settings', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setSettings(data.settings));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/cleanup-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        const error = await response.json();
        alert(error.message);
        return;
      }
      
      alert('Settings saved successfully!');
    } finally {
      setLoading(false);
    }
  };

  if (!settings) return <div>Loading...</div>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
      <label>
        Articles per feed:
        <input
          type="number"
          min={50}
          max={500}
          value={settings.articles_per_feed}
          onChange={(e) => setSettings({
            ...settings,
            articles_per_feed: parseInt(e.target.value)
          })}
        />
      </label>
      
      <label>
        Unread article age (days):
        <input
          type="number"
          min={7}
          max={90}
          value={settings.unread_article_age_days}
          onChange={(e) => setSettings({
            ...settings,
            unread_article_age_days: parseInt(e.target.value)
          })}
        />
      </label>
      
      <label>
        <input
          type="checkbox"
          checked={settings.enable_auto_cleanup}
          onChange={(e) => setSettings({
            ...settings,
            enable_auto_cleanup: e.target.checked
          })}
        />
        Enable automatic cleanup
      </label>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  );
}
```

### React Component (Admin Dashboard)

```typescript
import { useState, useEffect } from 'react';

export function CleanupDashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    // Load stats
    fetch('/api/admin/cleanup-stats', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setStats(data.stats));
  }, []);

  useEffect(() => {
    // Load logs
    fetch(`/api/admin/cleanup-logs?page=${page}&limit=50`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setLogs(data.logs));
  }, [page]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h2>Cleanup Statistics</h2>
      <div>
        <p>Total Cleanups: {stats.totalCleanups}</p>
        <p>Total Articles Deleted: {stats.totalArticlesDeleted}</p>
        <p>Average Duration: {stats.averageDuration}ms</p>
        <p>Error Rate: {(stats.errorRate * 100).toFixed(2)}%</p>
      </div>

      <h3>Last 24 Hours</h3>
      <div>
        <p>Cleanups: {stats.last24Hours.cleanups}</p>
        <p>Articles Deleted: {stats.last24Hours.articlesDeleted}</p>
        <p>Errors: {stats.last24Hours.errors}</p>
      </div>

      <h3>Recent Logs</h3>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>User ID</th>
            <th>Trigger</th>
            <th>Deleted</th>
            <th>Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.userId.slice(0, 8)}...</td>
              <td>{log.triggerType}</td>
              <td>{log.articlesDeleted}</td>
              <td>{log.durationMs}ms</td>
              <td>{log.errorMessage ? '❌ Error' : '✅ Success'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Related Documentation

- [Article Cleanup System Implementation](../ARTICLE_CAP_IMPLEMENTATION.md)
- [User Guide: Cleanup Settings](USER_GUIDE_CLEANUP_SETTINGS.md)
- [Scheduled Cleanup Configuration](SCHEDULED_CLEANUP.md)
- [Database Schema Documentation](DATABASE_SCHEMA_DOCUMENTATION.md)

---

## Support

For API issues or questions:
1. Check this documentation for endpoint details
2. Review error responses for specific issues
3. Check server logs for detailed error information
4. Contact development team with specific API call details
