import Sentry from './sentry';

export interface ErrorContext {
  operation?: string;
  event?: Record<string, any>;
  kafka?: {
    topic?: string;
    partition?: number;
    offset?: string;
  };
  [key: string]: any;
}

export const captureError = (error: Error, context: ErrorContext = {}) => {
  Sentry.withScope(scope => {
    // Add all context as extra data
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, JSON.stringify(value));
    });

    // Set specific tags for better filtering
    if (context.operation) {
      scope.setTag('operation', context.operation);
    }
    if (context.kafka?.topic) {
      scope.setTag('kafka.topic', context.kafka.topic);
    }

    // Capture the error
    Sentry.captureException(error);
  });
};
