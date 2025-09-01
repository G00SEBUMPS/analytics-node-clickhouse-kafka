import { Kafka, KafkaJSError } from 'kafkajs';
import { createClient } from '@clickhouse/client';
import { Logger } from './logger';
import { captureError } from './error-handler';

// Wrap async functions to ensure errors are captured
const withErrorHandling = async <T>(operation: () => Promise<T>, context: Record<string, any> = {}): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      captureError(error, {
        operation: context.operation,
        ...context
      });
    }
    throw error;
  }
};
const logger = new Logger('transform-service');

// Initialize Kafka consumer
const kafka = new Kafka({
  clientId: 'analytics-transform',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ 
  groupId: 'analytics-transform-group',
  sessionTimeout: 60000
});

// Initialize ClickHouse client
const clickhouse = createClient({
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'admin',
  database: process.env.CLICKHOUSE_DB || 'default',
});

// Create events table if not exists
async function setupClickHouse() {
  // Drop existing table if exists
  await clickhouse.query({
    query: `DROP TABLE IF EXISTS events`
  });

  // Create new table
  await clickhouse.query({
    query: `
      CREATE TABLE IF NOT EXISTS events (
        event_id String,
        user_id String,
        event_name String,
        event_time DateTime64(3),
        payload String,
        processed_at DateTime64(3) DEFAULT now64(3)
      )
      ENGINE = MergeTree()
      PARTITION BY toYYYYMM(event_time)
      ORDER BY (event_time, event_id)
    `
  });
}

interface Event {
  event_id: string;
  user_id: string;
  event_name: string;
  event_time: string;
  payload: Record<string, any>;
}

// Main consumer function
async function start() {
  try {
    // Setup ClickHouse
    await withErrorHandling(
      () => setupClickHouse(),
      { operation: 'setupClickHouse' }
    );
    logger.info('ClickHouse table setup complete');
    
    // Connect to Kafka
    await withErrorHandling(
      () => consumer.connect(),
      { operation: 'kafkaConnect' }
    );
    logger.info('Connected to Kafka');
    
    // Subscribe to topic
    await withErrorHandling(
      () => consumer.subscribe({ topic: 'events.raw.v1', fromBeginning: true }),
      { operation: 'kafkaSubscribe', topic: 'events.raw.v1' }
    );
    logger.info('Subscribed to events.raw.v1 topic');
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value?.toString() || '{}') as Event;
          
          logger.info('Processing event', { 
            event_id: event.event_id,
            event_name: event.event_name,
            event_time: event.event_time 
          });

          const values = [{
            event_id: event.event_id,
            user_id: event.user_id,
            event_name: event.event_name,
            event_time: new Date(event.event_time).toISOString(), // Ensure proper DateTime format
            payload: JSON.stringify(event.payload || {})
          }];

          logger.info('Inserting into ClickHouse', { values });

          // Insert into ClickHouse
          await clickhouse.insert({
            table: 'events',
            values,
            format: 'JSONEachRow',
            clickhouse_settings: {
              date_time_input_format: 'best_effort'
            }
          });
          
          logger.info(`Processed event: ${event.event_id}`, { topic, partition, offset: message.offset });
        } catch (error) {
          logger.error('Failed to process message', {
            topic,
            partition,
            offset: message.offset,
            error
          });

          if (error instanceof Error) {
            captureError(error, {
              operation: 'processMessage',
              event,
              kafka: {
                topic,
                partition,
                offset: message.offset
              }
            });
          }
        }
      },
    });
  } catch (error) {
    logger.error('Failed to start service', error);
    if (error instanceof Error) {
      captureError(error, { operation: 'startService' });
    }
    process.exit(1);
  }
}

// Error handling and graceful shutdown
process.on('SIGTERM', async () => {
  try {
    logger.info('Received SIGTERM, shutting down');
    await consumer.disconnect();
    await clickhouse.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  try {
    logger.info('Received SIGINT, shutting down');
    await consumer.disconnect();
    await clickhouse.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception', error);
  try {
    await consumer.disconnect();
    await clickhouse.close();
  } finally {
    if (error instanceof Error) {
      captureError(error, { operation: 'uncaughtException' });
    }
    process.exit(1);
  }
});

// Flush Sentry events on exit
process.on('exit', () => {
  Sentry.getCurrentHub().getClient()?.close(2000).catch(() => {
    process.exit(1);
  });
});

start();
