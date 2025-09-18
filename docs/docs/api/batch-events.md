---
sidebar_position: 3
---

# Batch Events

Send multiple events in a single request.

## Endpoint

```http
POST /ingest/batch
```

## Request Body Schema

```typescript
{
  "batchId": string,          // Unique identifier for the batch
  "sentAt": string,           // ISO 8601 datetime
  "clientInfo": {
    "sdkVersion": string,     // SDK version
    "deviceId": string,       // Device identifier
    "appBuild": string        // Application build number
  },
  "events": [                 // Array of events (max 50)
    {
      // Same schema as single event
    }
  ]
}
```

## Example Request

```bash
curl -X POST http://localhost:4000/ingest/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "batchId": "batch_123456789",
    "sentAt": "2025-09-17T10:00:00Z",
    "clientInfo": {
      "sdkVersion": "1.2.0",
      "deviceId": "device_123",
      "appBuild": "145"
    },
    "events": [
      {
        "event_id": "evt_123456789",
        "event_type": "click",
        "event_name": "button_click",
        "event_time": "2025-09-17T10:00:00Z",
        "user_id": "usr_987654321",
        "session_id": "sess_123456789",
        "page_name": "checkout",
        "device_type": "mobile",
        "platform": "ios",
        "app_version": "2.1.0",
        "network_type": "wifi"
      }
    ]
  }'
```

## Success Response

```json
{
  "status": "success",
  "batchId": "batch_123456789",
  "eventsProcessed": 1
}
```

## Error Response

```json
{
  "error": "Batch too large",
  "message": "Maximum batch size is 50 events"
}
```

## Important Notes

1. Maximum batch size is 50 events
2. Events are compressed using GZIP
3. All timestamps must be in ISO 8601 format
4. Required fields must be provided for each event
5. Events are processed asynchronously via Kafka