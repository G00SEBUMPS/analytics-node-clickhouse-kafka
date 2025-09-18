---
sidebar_position: 1
---

# API Overview

The MeetMux Analytics API allows you to track events and analyze user behavior in your application. This documentation provides detailed information about the available endpoints, authentication, and data formats.

## Base URL

```
http://localhost:4000
```

## Authentication

All API endpoints require authentication using an API key. Include your API key in the request headers:

```http
X-API-Key: your_api_key
```

## Rate Limiting

Rate limits are applied per API key and are based on:
- Number of requests allowed
- Time window (in seconds)

Rate limit information is:
- Cached in Redis for performance
- Persisted to database periodically
- Reset automatically after the time window

## Response Formats

All responses are in JSON format and include:
- Success/error status
- Relevant data or error messages
- Detailed validation errors when applicable

## Error Codes

| Status Code | Description |
|------------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid API key |
| 403 | Forbidden - IP not allowed |
| 429 | Too Many Requests - Rate limit exceeded |
| 503 | Service Unavailable - System error |