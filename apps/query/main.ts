import 'reflect-metadata';
// NestJS Query Service (TypeScript)
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Query } from '@nestjs/common';
import { ClickHouseService } from './clickhouse.service';
import { Transport, GrpcOptions } from '@nestjs/microservices';
import * as path from 'path';

@Controller('analytics')
class AnalyticsController {
  constructor(private readonly clickhouse: ClickHouseService) {}

  @Get('timeseries')
  async getTimeseries(@Query() query: any) {
    // Example: Query ClickHouse for timeseries data
    const sql = 'SELECT event_time, count() as value FROM events WHERE event_time >= now() - INTERVAL 1 DAY GROUP BY event_time ORDER BY event_time';
    const rows = await this.clickhouse.query(sql);
    const points = (rows || []).map((row: any) => ({ time: row.event_time, value: row.value }));
    return { points };
  }

  @Get('topn')
  async getTopN(@Query() query: any) {
    // Example: Query ClickHouse for top-N analytics
    const sql = 'SELECT event_name, count() as events FROM events WHERE event_time >= now() - INTERVAL 1 DAY GROUP BY event_name ORDER BY events DESC LIMIT 10';
    const rows = await this.clickhouse.query(sql);
    return { data: rows, query };
  }
}

@Module({
  controllers: [AnalyticsController],
  providers: [ClickHouseService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<GrpcOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'analytics',
      protoPath: path.join(__dirname, '../../protos/analytics.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT || 50051}`,
    },
  });
  await app.startAllMicroservices();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  await app.listen(port);
  console.log(`Query service running on HTTP ${port} and gRPC ${process.env.GRPC_PORT || 50051}`);
}

bootstrap();
