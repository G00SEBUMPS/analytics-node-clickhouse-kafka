// Fastify Ingest Service (TypeScript)
import 'dotenv/config';
import Fastify from 'fastify';
import { Kafka, CompressionTypes } from 'kafkajs';
import {Ajv} from 'ajv';
import addFormats from "ajv-formats";
import fastifyCompress from '@fastify/compress';
import { Logger } from './logger.js';
import { Event, EventBatch } from './types.js';
import { 
  FastifyRequest as Request, 
  FastifyReply as Reply, 
  RouteHandlerMethod 
} from 'fastify';
import { authenticate, redis } from './auth.js';
import { captureError } from './error-handler.js';
import './sentry'; // Initialize Sentry
import { RedisHealth } from './redis-health.js';

// Type definitions for route handlers
interface EventBody {
  Body: Event;
}

interface BatchRequest {
  Body: EventBatch;
}

interface HealthBody {
  Body: Record<string, never>;
}
const logger = new Logger('ingest-service');
const fastify = Fastify({ logger: false });

// Initialize Redis health check
const redisHealth = new RedisHealth(redis);

const kafka = new Kafka({ 
  clientId: 'analytics-ingest',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 5
  },
  connectionTimeout: 10000,
  authenticationTimeout: 10000,
});
const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000
});
const ajv = new Ajv({
  allErrors: true,           // Check all rules collecting all errors
  verbose: true,            // Include validated data in errors
  $data: true,             // Enable $data references
  strictTypes: true,       // Restrict types strictly
  strictTuples: true,      // Enforce tuple length
  strictRequired: true,    // No additional properties in required
  coerceTypes: false,      // Don't coerce types automatically
  messages: true           // Include error messages
});

// Add formats (date-time, email, etc.)
addFormats.default(ajv);

// Custom error formatting
function formatValidationErrors(errors: any[]) {
  return errors.map(error => ({
    field: error.instancePath || 'root',
    message: error.message,
    code: `validation.${error.keyword}`,
    params: error.params
  }));
}
// Basic event schema
// Batch validation schema
const batchSchema = {
  type: 'object',
  properties: {
    batchId: { type: 'string' },
    sentAt: { type: 'string', format: 'date-time' },
    clientInfo: {
      type: 'object',
      properties: {
        sdkVersion: { type: 'string' },
        deviceId: { type: 'string' },
        appBuild: { type: 'string' }
      },
      required: ['sdkVersion', 'deviceId', 'appBuild']
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
          event_type: { type: 'string' },
          event_name: { type: 'string' },
          event_time: { type: 'string', format: 'date-time' },
          user_id: { type: 'string' },
          session_id: { type: 'string' },
          page_name: { type: 'string' },
          element_id: { type: 'string' },
          referrer: { type: 'string' },
          device_type: { type: 'string', enum: ['mobile', 'desktop', 'tablet'] },
          platform: { type: 'string', enum: ['ios', 'android', 'web'] },
          app_version: { type: 'string' },
          network_type: { type: 'string', enum: ['wifi', 'cellular', 'unknown'] },
          content: { type: 'object' },
          behavior: { type: 'object' },
          performance: { type: 'object' },
          location: { type: 'object' },
          commerce: { type: 'object' },
          interaction: { type: 'object' },
          experiments: { type: 'object' },
          extras: { type: 'object' }
        },
        required: ['event_id', 'event_type', 'event_name', 'event_time', 'user_id', 'session_id', 'page_name']
      },
      minItems: 1,
      maxItems: 50 // Maximum batch size
    }
  },
  required: ['batchId', 'sentAt', 'clientInfo', 'events']
};
const validateBatch = ajv.compile(batchSchema);

// Register compression middleware
fastify.register(fastifyCompress);

// Import admin setup
import { setupAdmin } from './admin/admin.config.js';
// Single event ingestion endpoint
fastify.post<{ Body: Event }>('/ingest', async (request: Request<{ Body: Event }>, reply: Reply) => {
  try {
    const event = request.body as Event;
    
    // Validate single event using batch schema for consistency
    const singleEventBatch = {
      batchId: event.event_id, // Use event_id as batch id for single events
      sentAt: event.event_time,
      clientInfo: {
        sdkVersion: event.app_version || 'unknown',
        deviceId: event.device_type || 'unknown',
        appBuild: event.app_version || 'unknown'
      },
      events: [event]
    };

    if (!validateBatch(singleEventBatch)) {
      const validationErrors = formatValidationErrors(validateBatch.errors || []);
      logger.error('Invalid event', { errors: validationErrors, event });
      captureError(new Error('Event validation failed'), {
        operation: 'validateSingleEvent',
        errors: validationErrors,
        event
      });
      return reply.status(400).send({ 
        error: 'Invalid event',
        details: validationErrors
      });
    }

    logger.info('Processing single event', { 
      eventId: event.event_id,
      eventName: event.event_name,
      userId: event.user_id 
    });

    try {
      await producer.send({
        topic: 'events.raw.v1',
        messages: [{
          key: event.event_id,
          value: JSON.stringify({
            ...event,
            ingestedAt: new Date().toISOString()
          })
        }]
      });

      logger.info('Event published', { 
        eventId: event.event_id,
        topic: 'events.raw.v1' 
      });

      return reply.send({
        status: 'success',
        eventId: event.event_id
      });

    } catch (kafkaError) {
      logger.error('Failed to publish event to Kafka', {
        error: kafkaError,
        eventId: event.event_id
      });

      return reply.status(503).send({
        error: 'Service unavailable',
        message: 'Failed to process event'
      });
    }

  } catch (error) {
    logger.error('Unexpected error processing event', error);
    return reply.status(500).send({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
});

// Batch ingestion endpoint
fastify.post<BatchRequest>('/ingest/batch', async (request, reply) => {
  try {
    const batch = request.body as EventBatch;
    
    if (!validateBatch(batch)) {
      logger.error('Invalid batch', { errors: validateBatch.errors, batch });
      return reply.status(400).send({ error: 'Invalid batch', details: validateBatch.errors });
    }

    // Validate batch size limits
    if (batch.events.length > 50) {
      return reply.status(400).send({ 
        error: 'Batch too large',
        message: 'Maximum batch size is 50 events'
      });
    }
    
    logger.info('Processing batch', { 
      batchId: batch.batchId,
      eventCount: batch.events.length,
      clientInfo: batch.clientInfo 
    });

    try {
      // Send batch to Kafka with compression
      await producer.send({
        topic: 'events.raw.v1',
        compression: CompressionTypes.GZIP,
        messages: batch.events.map(event => ({
          key: event.event_id,
          value: JSON.stringify({
            ...event,
            clientInfo: batch.clientInfo,
            batchId: batch.batchId,
            batchSentAt: batch.sentAt,
            ingestedAt: new Date().toISOString()
          })
        }))
      });
      
      logger.info('Batch published', { 
        batchId: batch.batchId,
        topic: 'events.raw.v1',
        eventCount: batch.events.length
      });

      return reply.send({
        status: 'success',
        batchId: batch.batchId,
        eventsProcessed: batch.events.length
      });

    } catch (kafkaError) {
      logger.error('Failed to publish batch to Kafka', {
        error: kafkaError,
        batchId: batch.batchId
      });

      return reply.status(503).send({
        error: 'Service unavailable',
        message: 'Failed to process event batch'
      });
    }

  } catch (error) {
    logger.error('Unexpected error processing batch', error);
    return reply.status(500).send({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
});

// Rate limiting is handled by the auth middleware

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  try {
    // Check Kafka connection by sending a test message
    let kafkaStatus = 'healthy';
    try {
      await producer.send({
        topic: 'events.raw.v1',
        messages: []
      });
    } catch (kafkaError) {
      kafkaStatus = 'unhealthy';
    }

    // Check Redis health
    const redisHealthy = await redisHealth.check();

    if (!redisHealthy || kafkaStatus === 'unhealthy') {
      return reply.status(503).send({
        status: 'unhealthy',
        kafka: kafkaStatus,
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    }

    return reply.send({
      status: 'healthy',
      kafka: kafkaStatus,
      redis: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed', error);
    return reply.status(503).send({
      status: 'unhealthy',
      kafka: 'unknown',
      redis: redisHealth.getStatus(),
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

const start = async () => {
  try {
    // Setup admin panel before any other routes
    await setupAdmin(fastify);
    
    // Add authentication after admin setup
    fastify.addHook('preHandler', authenticate);
    
    await producer.connect();
    logger.info('Connected to Kafka');
    
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
    await fastify.listen({ port, host: '0.0.0.0' });
    logger.info(`Ingest service running on ${port}`);
  } catch (error) {
    logger.error('Failed to start service', error);
    process.exit(1);
  }
};

process.on('uncaughtException', error => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', reason);
});

process.on('SIGTERM', async () => {
  try {
    await producer.disconnect();
    await fastify.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  try {
    await producer.disconnect();
    await fastify.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

start();
