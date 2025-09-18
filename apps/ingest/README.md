# Ingest Service

The Ingest Service is responsible for receiving and validating analytics events before publishing them to Kafka for further processing.

## Features

- Real-time event ingestion
- Batch event processing
- Request validation
- Rate limiting
- IP filtering
- GZIP compression support
- Authentication via API keys

## Tech Stack

- Node.js
- TypeScript
- Fastify
- Kafka
- Redis
- PostgreSQL

## API Endpoints

- `POST /ingest` - Single event ingestion
- `POST /ingest/batch` - Batch event ingestion
- `GET /health` - Service health check

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Kafka Configuration
KAFKA_BROKER=localhost:9092
PORT=4000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Database Configuration
DATABASE_URL=postgres://user:password@localhost:5432/analytics
```

3. Run database migrations:
```bash
npm run migrate
```

4. Start the service:
```bash
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4000 |
| KAFKA_BROKER | Kafka broker address | localhost:9092 |
| REDIS_HOST | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |
| REDIS_PASSWORD | Redis password | - |
| DATABASE_URL | PostgreSQL connection string | - |

## Architecture

The ingest service follows these steps:
1. Receives events via HTTP endpoints
2. Validates request format and data
3. Checks API key and rate limits
4. Publishes valid events to Kafka
5. Returns success/error response to client

## Error Handling

- Request validation errors (400)
- Authentication errors (401)
- IP filtering errors (403)
- Rate limiting errors (429)
- Server errors (500, 503)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request