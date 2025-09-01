// Minimal Node.js gRPC client for AnalyticsQuery.GetTimeseries
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../../protos/analytics.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const analyticsProto = grpc.loadPackageDefinition(packageDefinition).analytics as any;

const client = new analyticsProto.AnalyticsQuery(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

client.GetTimeseries({ tenant_id: 'demo', metric: 'events' }, (err: any, response: any) => {
  if (err) {
    console.error('gRPC error:', err);
  } else {
    console.log('gRPC response:', response);
  }
});
