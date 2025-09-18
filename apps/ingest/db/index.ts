import { Pool } from 'pg';
import { Logger } from '../logger';

const logger = new Logger('database');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', err);
});

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  active: boolean;
  allowed_ips: string[] | null;
  rate_limit_requests: number;
  rate_limit_window: number;
}

class Database {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async getApiKey(key: string): Promise<ApiKey | null> {
    try {
      const result = await this.pool.query<ApiKey>(
        'SELECT * FROM api_keys WHERE key = $1 AND active = true',
        [key]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching API key', error);
      throw error;
    }
  }

  async checkRateLimit(apiKeyId: string, clientIp: string, window: number, limit: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Count requests in the current window
      const result = await client.query(
        `SELECT COUNT(*) 
         FROM rate_limits 
         WHERE api_key_id = $1 
         AND client_ip = $2 
         AND request_time > NOW() - interval '1 second' * $3`,
        [apiKeyId, clientIp, window]
      );

      const count = parseInt(result.rows[0].count);
      
      if (count >= limit) {
        await client.query('COMMIT');
        return false;
      }

      // Record the new request
      await client.query(
        `INSERT INTO rate_limits (api_key_id, client_ip) 
         VALUES ($1, $2)`,
        [apiKeyId, clientIp]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error checking rate limit', error);
      return true; // Allow on error
    } finally {
      client.release();
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.pool.query('SELECT cleanup_rate_limits()');
    } catch (error) {
      logger.error('Error cleaning up rate limits', error);
    }
  }
}

export const db = new Database();

// Clean up old rate limit entries periodically
setInterval(() => {
  db.cleanup().catch(error => {
    logger.error('Rate limit cleanup failed', error);
  });
}, 3600000); // Run every hour