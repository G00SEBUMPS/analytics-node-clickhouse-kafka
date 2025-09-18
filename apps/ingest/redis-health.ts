import Redis from 'ioredis';
import { Logger } from './logger';

const logger = new Logger('redis-health');

export class RedisHealth {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor(redis: Redis) {
    this.redis = redis;
    this.setupListeners();
  }

  private setupListeners() {
    this.redis.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected');
    });

    this.redis.on('error', (err) => {
      this.isConnected = false;
      logger.error('Redis connection error', err);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.error('Redis connection closed');
    });
  }

  async check(): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', error);
      return false;
    }
  }

  getStatus(): string {
    return this.isConnected ? 'healthy' : 'unhealthy';
  }
}