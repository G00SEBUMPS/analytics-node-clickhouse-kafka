import { Kafka, KafkaJSError } from 'kafkajs';
import { createClient } from '@clickhouse/client';
import { Logger } from './logger';
import { captureError } from './error-handler';
import * as Sentry from "@sentry/node";
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
  // Create a deduplication buffer table
  await clickhouse.query({
    query: `
      CREATE TABLE IF NOT EXISTS events_buffer (
        -- Core Event Fields
        event_id String,
        event_type String,
        event_name String,
        event_time DateTime64(3),
        processed_at DateTime64(3) DEFAULT now64(3),
        
        -- User Context
        user_id String,
        session_id String,
        page_name String,
        element_id String,
        referrer String,
        
        -- Device Information
        device_type Enum8('mobile' = 1, 'desktop' = 2, 'tablet' = 3),
        platform Enum8('ios' = 1, 'android' = 2, 'web' = 3),
        app_version String,
        network_type Enum8('wifi' = 1, 'cellular' = 2, 'unknown' = 3),
        
        -- Content Information
        content_id String,
        content_type Enum8('post' = 1, 'comment' = 2, 'story' = 3, 'message' = 4, 'ad' = 5),
        media_type Enum8('image' = 1, 'video' = 2, 'text' = 3, 'audio' = 4),
        category String,
        is_sponsored UInt8,
        age_hours Float64,
        
        -- Behavioral Data
        scroll_direction Enum8('up' = 1, 'down' = 2, 'left' = 3, 'right' = 4),
        position UInt32,
        duration_ms UInt64,
        scroll_depth Float32,
        zoom_level Float32,
        playback_position Float32,
        is_autoplay UInt8,
        
        -- Performance Metrics
        load_time_ms UInt32,
        connection_speed Enum8('slow' = 1, 'medium' = 2, 'fast' = 3),
        
        -- Location Data
        city String,
        country String,
        timezone String,
        latitude Float64,
        longitude Float64,
        location_accuracy Enum8('high' = 1, 'medium' = 2, 'low' = 3),
        
        -- Commerce Data
        product_id String,
        price Float64,
        currency String,
        transaction_id String,
        promotion_code String,
        
        -- Raw JSON Data (for flexibility)
        raw_content String,           -- JSON string of full content object
        raw_interaction String,       -- JSON string of interaction details
        raw_behavior String,          -- JSON string of behavior data
        raw_performance String,       -- JSON string of performance metrics
        raw_commerce String,          -- JSON string of commerce data
        raw_location String,          -- JSON string of location data
        raw_experiments String,       -- JSON string of A/B tests & feature flags
        raw_extras String             -- JSON string of any custom data
      )
      ENGINE = MergeTree()
      PARTITION BY toYYYYMM(event_time)
      ORDER BY (event_id, event_time)
      PRIMARY KEY (event_id)
      SETTINGS index_granularity = 8192
    `
  });

  // Create the main events table with deduplication
  await clickhouse.query({
    query: `
      CREATE TABLE IF NOT EXISTS events
      ENGINE = ReplacingMergeTree(processed_at)
      PARTITION BY toYYYYMM(event_time)
      ORDER BY (event_id, event_time)
      PRIMARY KEY (event_id)
      AS SELECT * FROM events_buffer
    `
  });

  // Create materialized view to deduplicate and insert events
  await clickhouse.query({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS events_mv
      TO events
      AS SELECT 
        event_id,
        event_type AS event_type,
        event_name AS event_name,
        event_time AS event_time,
        processed_at AS processed_at,
        user_id AS user_id,
        session_id AS session_id,
        page_name AS page_name,
        element_id AS element_id,
        referrer AS referrer,
        device_type AS device_type,
        platform AS platform,
        app_version AS app_version,
        network_type AS network_type,
        content_id AS content_id,
        content_type AS content_type,
        media_type AS media_type,
        category AS category,
        is_sponsored AS is_sponsored,
        age_hours AS age_hours,
        scroll_direction AS scroll_direction,
        position AS position,
        duration_ms AS duration_ms,
        scroll_depth AS scroll_depth,
        zoom_level AS zoom_level,
        playback_position AS playback_position,
        is_autoplay AS is_autoplay,
        load_time_ms AS load_time_ms,
        connection_speed AS connection_speed,
        city AS city,
        country AS country,
        timezone AS timezone,
        latitude AS latitude,
        longitude AS longitude,
        location_accuracy AS location_accuracy,
        product_id AS product_id,
        price AS price,
        currency AS currency,
        transaction_id AS transaction_id,
        promotion_code AS promotion_code,
        raw_content AS raw_content,
        raw_interaction AS raw_interaction,
        raw_behavior AS raw_behavior,
        raw_performance AS raw_performance,
        raw_commerce AS raw_commerce,
        raw_location AS raw_location,
        raw_experiments AS raw_experiments,
        raw_extras AS raw_extras
      FROM events_buffer
      GROUP BY 
        event_id,
        event_type,
        event_name,
        event_time,
        processed_at,
        user_id,
        session_id,
        page_name,
        element_id,
        referrer,
        device_type,
        platform,
        app_version,
        network_type,
        content_id,
        content_type,
        media_type,
        category,
        is_sponsored,
        age_hours,
        scroll_direction,
        position,
        duration_ms,
        scroll_depth,
        zoom_level,
        playback_position,
        is_autoplay,
        load_time_ms,
        connection_speed,
        city,
        country,
        timezone,
        latitude,
        longitude,
        location_accuracy,
        product_id,
        price,
        currency,
        transaction_id,
        promotion_code,
        raw_content,
        raw_interaction,
        raw_behavior,
        raw_performance,
        raw_commerce,
        raw_location,
        raw_experiments,
        raw_extras
    `
  });
  
  // Create materialized view for user sessions
  await clickhouse.query({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_sessions
      ENGINE = AggregatingMergeTree()
      PARTITION BY toYYYYMM(start_time)
      ORDER BY (user_id, start_time)
      AS SELECT
        user_id,
        session_id,
        min(event_time) as start_time,
        max(event_time) as end_time,
        count() as event_count,
        any(device_type) as device_type,
        any(platform) as platform,
        groupArray(event_type) as event_types,
        groupArray(event_name) as event_names
      FROM events
      GROUP BY user_id, session_id
    `
  });

  // Create materialized view for content performance
  await clickhouse.query({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_content_performance
      ENGINE = AggregatingMergeTree()
      PARTITION BY toYYYYMM(event_date)
      ORDER BY (content_id, event_date)
      AS SELECT
        content_id,
        content_type,
        media_type,
        toDate(event_time) as event_date,
        count() as view_count,
        avg(duration_ms) as avg_duration,
        avg(scroll_depth) as avg_scroll_depth,
        countIf(is_autoplay = 1) as autoplay_count
      FROM events
      WHERE event_type = 'impression'
      GROUP BY content_id, content_type, media_type, event_date
    `
  });

  // Create materialized view for user engagement
  await clickhouse.query({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_engagement
      ENGINE = AggregatingMergeTree()
      PARTITION BY toYYYYMM(event_date)
      ORDER BY (user_id, event_date)
      AS SELECT
        user_id,
        toDate(event_time) as event_date,
        count() as total_events,
        countIf(event_type = 'impression') as impressions,
        countIf(event_type = 'click') as clicks,
        avg(duration_ms) as avg_duration,
        max(scroll_depth) as max_scroll_depth
      FROM events
      GROUP BY user_id, event_date
    `
  });
}

interface Event {
  // Core Event Fields
  event_id: string;
  event_type: string;
  event_name: string;
  event_time: string;
  
  // User Context
  user_id: string;
  session_id: string;
  page_name: string;
  element_id?: string;
  referrer?: string;

  // Device Information
  device_type: 'mobile' | 'desktop' | 'tablet';
  platform: 'ios' | 'android' | 'web';
  app_version?: string;
  network_type?: 'wifi' | 'cellular' | 'unknown';

  // Content Information
  content?: {
    content_id: string;
    content_type: 'post' | 'comment' | 'story' | 'message' | 'ad';
    media_type: 'image' | 'video' | 'text' | 'audio';
    category?: string;
    is_sponsored?: boolean;
    age_hours?: number;
  };

  // Behavioral Data
  behavior?: {
    direction?: 'up' | 'down' | 'left' | 'right';
    position?: number;
    duration_ms?: number;
    scroll_depth?: number;
    zoom_level?: number;
    playback_position?: number;
    is_autoplay?: boolean;
  };

  // Performance Metrics
  performance?: {
    load_time_ms: number;
    connection_speed: 'slow' | 'medium' | 'fast';
  };

  // Location Data
  location?: {
    city?: string;
    country?: string;
    timezone?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    location_accuracy?: 'high' | 'medium' | 'low';
  };

  // Commerce Data
  commerce?: {
    product_id?: string;
    price?: number;
    currency?: string;
    transaction_id?: string;
    promotion_code?: string;
  };

  // Additional Contexts (stored as raw JSON)
  interaction?: Record<string, any>;
  experiments?: object;
  extras?: Record<string, any>;
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

          // Transform and insert the event
          const eventValues = [{
            // Core Event Fields
            event_id: event.event_id,
            event_type: event.event_type,
            event_name: event.event_name,
            event_time: new Date(event.event_time).toISOString(),
            
            // User Context
            user_id: event.user_id,
            session_id: event.session_id,
            page_name: event.page_name,
            element_id: event.element_id,
            referrer: event.referrer,
            
            // Device Information
            device_type: event.device_type,
            platform: event.platform,
            app_version: event.app_version,
            network_type: event.network_type,
            
            // Content Information
            content_id: event.content?.content_id,
            content_type: event.content?.content_type,
            media_type: event.content?.media_type,
            category: event.content?.category,
            is_sponsored: event.content?.is_sponsored ? 1 : 0,
            age_hours: event.content?.age_hours,
            
            // Behavioral Data
            scroll_direction: event.behavior?.direction,
            position: event.behavior?.position,
            duration_ms: event.behavior?.duration_ms,
            scroll_depth: event.behavior?.scroll_depth,
            zoom_level: event.behavior?.zoom_level,
            playback_position: event.behavior?.playback_position,
            is_autoplay: event.behavior?.is_autoplay ? 1 : 0,
            
            // Performance Metrics
            load_time_ms: event.performance?.load_time_ms,
            connection_speed: event.performance?.connection_speed,
            
            // Location Data
            city: event.location?.city,
            country: event.location?.country,
            timezone: event.location?.timezone,
            latitude: event.location?.coordinates?.latitude,
            longitude: event.location?.coordinates?.longitude,
            location_accuracy: event.location?.location_accuracy,
            
            // Commerce Data
            product_id: event.commerce?.product_id,
            price: event.commerce?.price,
            currency: event.commerce?.currency,
            transaction_id: event.commerce?.transaction_id,
            promotion_code: event.commerce?.promotion_code,
            
            // Raw JSON Data
            raw_content: event.content ? JSON.stringify(event.content) : null,
            raw_interaction: event.interaction ? JSON.stringify(event.interaction) : null,
            raw_behavior: event.behavior ? JSON.stringify(event.behavior) : null,
            raw_performance: event.performance ? JSON.stringify(event.performance) : null,
            raw_commerce: event.commerce ? JSON.stringify(event.commerce) : null,
            raw_location: event.location ? JSON.stringify(event.location) : null,
            raw_experiments: event.experiments ? JSON.stringify(event.experiments) : null,
            raw_extras: event.extras ? JSON.stringify(event.extras) : null
          }];

          logger.info('Inserting into ClickHouse', { values: eventValues });

          // Check for existing event first
          const existingEvent = await clickhouse.query({
            query: `SELECT 1 FROM events WHERE event_id = {event_id:String}`,
            query_params: {
              event_id: event.event_id
            },
            format: 'JSONEachRow'
          });

          const result = await existingEvent.json();
          if (result.length === 0) {
            // Insert into buffer table if no duplicate found
            await clickhouse.insert({
              table: 'events_buffer',
              values: eventValues,
              format: 'JSONEachRow',
              clickhouse_settings: {
                date_time_input_format: 'best_effort'
              }
            });
          } else {
            logger.info('Duplicate event detected, skipping', { 
              event_id: event.event_id,
              event_type: event.event_type
            });
          }
          
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
              // event,
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
  (Sentry.getClient()?.close(2000) as Promise<boolean>).catch(() => {
    process.exit(1);
  });
});

start();
