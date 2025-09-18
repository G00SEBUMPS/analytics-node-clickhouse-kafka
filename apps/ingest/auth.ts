import type { FastifyRequest as Request, FastifyReply as Reply } from 'fastify';
import { Logger } from './logger';
import Redis from 'ioredis';
import { ApiKey, RateLimitCounter, syncModels } from './db/models.js';
import crypto from 'crypto';

const logger = new Logger('auth-middleware');

// Initialize Sequelize models
syncModels().catch((error) => {
  logger.error('Failed to initialize Sequelize models', error);
  process.exit(1);
});

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

interface ApiKeyConfig {
  id: string;
  name: string;
  allowedIps?: string[];
  rateLimit: {
    requests: number;
    window: number; // in seconds
  };
}

async function getApiKeyConfig(apiKey: string): Promise<ApiKeyConfig | null> {
  const row = await ApiKey.findOne({
    where: { key: apiKey, active: true },
  });
  if (!row) return null;
  return {
    id: row.get('id'),
    name: row.get('name'),
    allowedIps: row.get('allowed_ips'),
    rateLimit: {
      requests: row.get('rate_limit_requests'),
      window: row.get('rate_limit_window'),
    },
  };
}

function isIpAllowed(apiKey: ApiKeyConfig, clientIp: string): boolean {
  if (!apiKey.allowedIps || apiKey.allowedIps.length === 0) {
    return true;
  }
  return Array.isArray(apiKey.allowedIps)
    ? apiKey.allowedIps.includes(clientIp)
    : false;
}

async function getRateLimitCount(keyId: string): Promise<number> {
  const count = await redis.get(`ratelimit:${keyId}`);
  return count ? parseInt(count, 10) : 0;
}

async function incrementRateLimit(keyId: string, window: number): Promise<number> {
  const key = `ratelimit:${keyId}`;
  const count = await redis.incr(key);
  
  // Set expiry on first increment
  if (count === 1) {
    await redis.expire(key, window);
  }
  
  return count;
}

export async function authenticate(request: Request, reply: Reply) {
  // Skip authentication for admin routes
  if (request.url.startsWith('/admin')) {
    return;
  }
  if (request.url.startsWith('/favicon')) {
    return;
  }
  const apiKey = request.headers['x-api-key'];
  const clientIp = request.ip;

  if (!apiKey || typeof apiKey !== 'string') {
    logger.error('Missing or invalid API key', { clientIp });
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid API key'
    });
  }

  try {
    const keyConfig = await getApiKeyConfig(apiKey);
    if (!keyConfig) {
      logger.error('Invalid API key', { apiKey, clientIp });
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    if (!isIpAllowed(keyConfig, clientIp)) {
      logger.error('IP not allowed', { apiKey, clientIp });
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'IP address not allowed'
      });
    }

    // Check rate limit from Redis using the key as rate limit key instead of ID
    const redisKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    const requestCount = await incrementRateLimit(redisKey, keyConfig.rateLimit.window);

    if (requestCount > keyConfig.rateLimit.requests) {
      logger.error('Rate limit exceeded', { apiKey, clientIp });
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded'
      });
    }

    // Every 10th request, persist the counter to Sequelize
    if (requestCount % 10 === 0) {
      try {
        await RateLimitCounter.upsert({
          api_key_id: keyConfig.id,
          window_start: new Date().toISOString().slice(0, 13) + ':00:00',
          request_count: requestCount,
        });
      } catch (error) {
        logger.error('Failed to persist rate limit counter', { error, keyConfig });
      }
    }

    // Add API key info to request for logging
    (request as any).apiKeyInfo = keyConfig;
  } catch (error) {
    logger.error('Authentication error', { error, clientIp });
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Error during authentication'
    });
  }
}

// Handle Redis connection errors
redis.on('error', (error: Error) => {
  logger.error('Redis connection error', { error });
});