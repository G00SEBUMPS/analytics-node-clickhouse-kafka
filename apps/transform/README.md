# Transform Service

The Transform Service processes raw analytics events from Kafka, enriches them, and stores them in ClickHouse for analysis.

## Features

- Event enrichment
- Data transformation
- Deduplication
- Schema validation
- Error handling
- Dead letter queue
- Batch processing

## Tech Stack

- Node.js
- TypeScript
- Kafka
- ClickHouse
- Protocol Buffers

## Event Processing

The service:
1. Consumes events from Kafka topic `events.raw.v1`
2. Validates event schema
3. Enriches events with additional data
4. Deduplicates events based on event_id
5. Stores processed events in ClickHouse
6. Handles errors via dead letter queue

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Kafka Configuration
KAFKA_BROKER=localhost:9092
KAFKA_GROUP_ID=transform-service

# ClickHouse Configuration
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=analytics
```

3. Start the service:
```bash
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| KAFKA_BROKER | Kafka broker address | localhost:9092 |
| KAFKA_GROUP_ID | Consumer group ID | transform-service |
| CLICKHOUSE_HOST | ClickHouse host | localhost |
| CLICKHOUSE_PORT | ClickHouse port | 8123 |
| CLICKHOUSE_DATABASE | Database name | analytics |

## Data Flow

```
[Kafka] -> [Transform Service] -> [ClickHouse]
   ↓              ↓
   └─────> [Dead Letter Queue]
```

## Error Handling

- Invalid event format
- Schema validation errors
- ClickHouse connection issues
- Kafka connectivity problems
- Dead letter queue for failed events

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request