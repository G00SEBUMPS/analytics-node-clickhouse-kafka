import * as Sentry from "@sentry/node";

// Initialize Sentry and verify it's working
function initSentry() {
  Sentry.init({
  dsn: process.env.SENTRY_DSN_INGEST,
  
  // Set environment
  environment: process.env.NODE_ENV || 'development',
  
  // Add service context
  initialScope: {
    tags: {
      service: 'analytics-ingest'
    }
  },

  // Enable performance monitoring
  tracesSampleRate: 1.0,
  
  // Enable console logging in development
  debug: process.env.NODE_ENV !== 'production',
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  // Enable structured logging
  enableLogs: true,
  
  // Include PII data like IP addresses
  sendDefaultPii: true,
});

  // Add context to all events
  Sentry.setTag("ingest", "user-ingest");
  Sentry.logger.info('User triggered test log', { action: 'test_log' });
  // Verify Sentry is working by sending a test event
  Sentry.captureMessage("Ingest service starting up", "info");

  return Sentry;
}

// Initialize and export Sentry
const SentryInstance = initSentry();
export default SentryInstance;
