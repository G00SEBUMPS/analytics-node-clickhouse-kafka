// Fastify Ingest Service (TypeScript)
import Fastify from 'fastify';
import { Kafka } from 'kafkajs';
import Ajv from 'ajv';
import addFormats from "ajv-formats";
import { Logger } from './logger';
import './sentry'; // Initialize Sentry
const logger = new Logger('ingest-service');
const fastify = Fastify();
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
const ajv = new Ajv();
addFormats(ajv);
// Example event schema
const eventSchema = {
  type: 'object',
  properties: {
    event_id: { type: 'string' },
    user_id: { type: 'string' },
    event_name: { type: 'string' },
    event_time: { type: 'string', format: 'date-time' },
    payload: { type: 'object' },
  },
  required: ['event_id', 'user_id', 'event_name', 'event_time'],
};
const validate = ajv.compile(eventSchema);

fastify.post('/ingest', async (request, reply) => {
  try {
    const event = request.body;
    
    if (!validate(event)) {
      logger.error('Invalid event', { errors: validate.errors, event });
      return reply.status(400).send({ error: 'Invalid event', details: validate.errors });
    }
    
    logger.info('Processing event', { 
      event_id: event.event_id,
      event_name: event.event_name,
      user_id: event.user_id 
    });
    
    // TODO: Idempotency check (event_id)
    await producer.send({
      topic: 'events.raw.v1',
      messages: [{ value: JSON.stringify(event) }],
    });
    
    logger.info('Event published', { 
      event_id: event.event_id,
      topic: 'events.raw.v1' 
    });
    
    reply.send({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to process event', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
});

const start = async () => {
  try {
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
