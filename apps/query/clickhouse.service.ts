import { createClient, type ClickHouseClient, ResponseJSON } from '@clickhouse/client';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ClickHouseService {
  private readonly client: ClickHouseClient;
  private readonly logger = new Logger(ClickHouseService.name);

  constructor() {
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || 'admin',
      database: process.env.CLICKHOUSE_DB || 'default',
      session_id: 'analytics_query_service',
    });
  }

  async query<T = any>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    try {
      const resultSet = await this.client.query({
        query: sql,
        format: 'JSONEachRow',
        clickhouse_settings: {
          mutations_sync: '2'
        },
        query_params: params,
      });
      
      const json = await resultSet.json<T>();
      return Array.isArray(json) ? json : [];
    } catch (error: any) {
      this.logger.error(`ClickHouse query failed: ${error?.message || 'Unknown error'}`, {
        sql,
        params,
        error: error?.toString(),
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
