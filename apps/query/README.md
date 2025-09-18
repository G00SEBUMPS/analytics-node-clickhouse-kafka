# Query Service

The Query Service provides a GraphQL API for querying analytics data stored in ClickHouse.

## Features

- GraphQL API
- Complex analytics queries
- Aggregations and grouping
- Time-series analysis
- Caching
- Query optimization
- Rate limiting

## Tech Stack

- Node.js
- TypeScript
- GraphQL
- ClickHouse
- Redis (for caching)

## GraphQL Endpoints

- `/graphql` - Main GraphQL endpoint
- `/graphql/playground` - GraphQL Playground (in development)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Server Configuration
PORT=4002

# ClickHouse Configuration
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=analytics

# Redis Configuration (for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
```

3. Start the service:
```bash
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4002 |
| CLICKHOUSE_HOST | ClickHouse host | localhost |
| CLICKHOUSE_PORT | ClickHouse port | 8123 |
| CLICKHOUSE_DATABASE | Database name | analytics |
| REDIS_HOST | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |

## Query Examples

```graphql
# Get event count by type
query {
  eventStats {
    eventType
    count
  }
}

# Get user activity over time
query {
  userActivity(
    timeRange: { start: "2025-01-01", end: "2025-12-31" }
    interval: DAY
  ) {
    timestamp
    activeUsers
  }
}
```

## Caching

- Query results are cached in Redis
- Cache TTL is configurable
- Cache invalidation on data updates
- Cache bypass for real-time queries

## Performance

- Query optimization
- Result pagination
- Field selection
- Query complexity limits
- Batch processing

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request