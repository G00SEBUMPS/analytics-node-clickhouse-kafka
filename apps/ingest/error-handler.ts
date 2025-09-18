import * as Sentry from '@sentry/node';

export function captureError(error: Error, context: Record<string, any> = {}) {
  Sentry.withScope(scope => {
    // Add context to the error
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }

    // Add user context if available
    if (context.user_id) {
      scope.setUser({
        id: context.user_id
      });
    }

    // Add transaction name if available
    if (context.operation) {
      scope.setTag('operation', context.operation);
    }

    // Capture the error
    Sentry.captureException(error);
  });
}