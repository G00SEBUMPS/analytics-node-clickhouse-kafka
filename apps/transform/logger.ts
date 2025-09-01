import * as Sentry from "@sentry/node";
export class Logger {
  constructor(private context: string) {}

  info(message: string, meta?: any) {
    const logData = {
      level: 'INFO',
      timestamp: new Date().toISOString(),
      context: this.context,
      message,
      ...meta
    };
    
    console.log(JSON.stringify(logData));
    
    // Add as breadcrumb in Sentry
    Sentry.addBreadcrumb({
      category: this.context,
      message,
      level: "info",
      data: meta
    });
  }

  error(message: string, error?: any) {
    const logData = {
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      context: this.context,
      message,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    };

    console.error(JSON.stringify(logData));

    // Send to Sentry
    if (error instanceof Error) {
      Sentry.withScope(scope => {
        scope.setTag('context', this.context);
        scope.setExtra('error', logData.error);
        Sentry.captureException(error);
      });
    } else {
      Sentry.withScope(scope => {
        scope.setTag('context', this.context);
        scope.setExtra('error', error);
        Sentry.captureMessage(message, "error");
      });
    }
  }
}
