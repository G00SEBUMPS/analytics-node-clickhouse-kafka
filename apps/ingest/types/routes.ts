import { FastifyRequest, FastifyReply } from 'fastify';
import { Event, EventBatch } from '../types';

export interface EventRequest extends FastifyRequest {
  body: Event;
}

export interface BatchRequest extends FastifyRequest {
  body: EventBatch;
}

export interface RouteHandler {
  (request: FastifyRequest, reply: FastifyReply): Promise<void>;
}