
# Meetmux Analytics Monorepo

## Overview
This monorepo contains two core microservices for scalable, real-time analytics:
- **Ingest Service** (`apps/ingest`): Fastify + TypeScript. Validates and ingests events, publishes to Kafka.
- **Query Service** (`apps/query`): NestJS + TypeScript. Exposes REST APIs (and ready for gRPC) to query analytics from ClickHouse.

## Prerequisites
- Node.js 18+
- Docker (for Kafka, ClickHouse, Redis)

## Quick Start
### 1. Start Infrastructure
```
docker-compose up -d
```
This starts Kafka, Zookeeper, ClickHouse, and Redis.

### 2. Ingest Service
```
cd apps/ingest
npm install
npm run start
```
- **Config:**
	- `PORT` (default: 4000)
	- `KAFKA_BROKER` (default: localhost:9092)
- **API:**
	- `POST /ingest` — Ingest an event
		- Body (JSON):
			```json
			{
				"event_id": "string",
				"user_id": "string",
				"event_name": "string",
				"event_time": "ISO8601 string",
				"payload": { "any": "object" }
			}
			```
		- Validates with AJV. Publishes to Kafka topic `events.raw.v1`.

### 3. Query Service
```
cd apps/query
npm install
npm run start
```
- **Config:**
	- `PORT` (default: 5000)
	- `CLICKHOUSE_HOST`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DB`
- **APIs:**
	- `GET /analytics/timeseries` — Example timeseries query (from ClickHouse)
	- `GET /analytics/topn` — Example top-N query (from ClickHouse)

## gRPC Communication (Planned)
- The Query and Schema services will expose and consume gRPC APIs for:
	- Schema validation
	- Project/tenant management
	- Analytics queries
- Use [@nestjs/microservices](https://docs.nestjs.com/microservices/grpc) for gRPC in NestJS.
- Example proto file (to be placed in `protos/`):
	```proto
	syntax = "proto3";
	package analytics;

	service AnalyticsQuery {
		rpc GetTimeseries (TimeseriesRequest) returns (TimeseriesResponse);
		rpc GetTopN (TopNRequest) returns (TopNResponse);
	}
	message TimeseriesRequest { string tenant_id = 1; string metric = 2; }
	message TimeseriesResponse { repeated TimeseriesPoint points = 1; }
	message TimeseriesPoint { string time = 1; int64 value = 2; }
	message TopNRequest { string tenant_id = 1; string metric = 2; int32 n = 3; }
	message TopNResponse { repeated TopNItem items = 1; }
	message TopNItem { string key = 1; int64 value = 2; }
	```

## Extending
- Add Avro schema registry for event validation.
- Add stream processors (Node.js workers, Flink, or Materialize) for sessions/funnels/retention.
- Add Redis caching in Query Service.
- Add Dockerfiles for each service for production deployment.

## Project Structure
```
apps/
	ingest/         # Fastify ingest microservice
		index.ts
		tsconfig.json
		package.json
	query/          # NestJS query microservice
		main.ts
		clickhouse.service.ts
		tsconfig.json
		package.json
protos/           # (planned) gRPC proto files
README.md         # This file
```

## Contact
For architecture, scaling, or implementation questions, contact the engineering team.
