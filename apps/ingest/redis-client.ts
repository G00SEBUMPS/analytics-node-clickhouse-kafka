import Redis from 'ioredis';
import { Logger } from './logger';

const logger = new Logger('redis-client');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('error', (error) => {
  logger.error('Redis connection error', error);
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

export default redis;