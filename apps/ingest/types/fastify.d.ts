import { FastifyRequest as OriginalRequest, FastifyReply as OriginalReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest extends OriginalRequest {
    apiKeyInfo?: {
      id: string;
      name: string;
      allowedIps?: string[];
      rateLimit: {
        requests: number;
        window: number;
      };
    };
    headers: {
      'x-api-key'?: string;
      [key: string]: string | string[] | undefined;
    };
    ip: string;
  }
  
  interface FastifyReply extends OriginalReply {
    status(code: number): FastifyReply;
  }
}