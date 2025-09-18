---
sidebar_position: 2
---

# Event Ingestion

## Single Event

Send a single analytics event to the API.

### Endpoint

```http
POST /ingest
```

### Request Body Schema

```typescript
{
  // Required fields
  "event_id": string,          // Unique identifier for the event
  "event_type": string,        // Type of event
  "event_name": string,        // Name of the event
  "event_time": string,        // ISO 8601 datetime
  "user_id": string,          // User identifier
  "session_id": string,       // Session identifier
  "page_name": string,        // Name of the page where event occurred

  // Optional fields
  "element_id"?: string,      // ID of the element
  "referrer"?: string,        // Referrer information
  "device_type": "mobile" | "desktop" | "tablet",
  "platform": "ios" | "android" | "web",
  "app_version": string,      // Application version
  "network_type": "wifi" | "cellular" | "unknown",
  "content"?: object,         // Content-related data
  "behavior"?: object,        // Behavior-related data
  "performance"?: object,     // Performance metrics
  "location"?: object,        // Location data
  "commerce"?: object,        // Commerce-related data
  "interaction"?: object,     // Interaction details
  "experiments"?: string[],   // Active experiments
  "extras"?: object          // Additional custom data
}
```

### Example Request

```bash
curl -X POST http://localhost:4000/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "event_id": "evt_123456789",
    "event_type": "click",
    "event_name": "button_click",
    "event_time": "2025-09-17T10:00:00Z",
    "user_id": "usr_987654321",
    "session_id": "sess_123456789",
    "page_name": "checkout",
    "element_id": "submit_button",
    "device_type": "mobile",
    "platform": "ios",
    "app_version": "2.1.0",
    "network_type": "wifi"
  }'
```

### Success Response

```json
{
  "status": "success",
  "eventId": "evt_123456789"
}
```

### Error Response

```json
{
  "error": "Invalid event",
  "details": [
    {
      "field": "event_time",
      "message": "must be a valid ISO 8601 datetime",
      "code": "validation.format"
    }
  ]
}
```