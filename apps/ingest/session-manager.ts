import { createHash } from 'crypto';
import { Logger } from './logger';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const logger = new Logger('session-manager');

export class SessionManager {
  private sessions: Map<string, number> = new Map(); // userId -> lastActivityTime

  generateSessionId(userId: string, timestamp: number): string {
    const hash = createHash('sha256');
    hash.update(`${userId}-${timestamp}`);
    return hash.digest('hex').substring(0, 32);
  }

  shouldStartNewSession(userId: string, timestamp: number): boolean {
    const lastActivity = this.sessions.get(userId);
    if (!lastActivity) return true;

    const timeSinceLastActivity = timestamp - lastActivity;
    return timeSinceLastActivity > SESSION_TIMEOUT;
  }

  enrichEventWithSession(event: any): any {
    const timestamp = new Date(event.event_time).getTime();
    const userId = event.user_id;

    if (this.shouldStartNewSession(userId, timestamp)) {
      // Start new session
      const sessionId = this.generateSessionId(userId, timestamp);
      this.sessions.set(userId, timestamp);
      logger.info('Starting new session', { userId, sessionId });
      return { ...event, session_id: sessionId, is_new_session: true };
    } else {
      // Continue existing session
      this.sessions.set(userId, timestamp);
      const sessionId = this.generateSessionId(userId, this.sessions.get(userId)!);
      return { ...event, session_id: sessionId, is_new_session: false };
    }
  }

  cleanupInactiveSessions() {
    const now = Date.now();
    for (const [userId, lastActivity] of this.sessions.entries()) {
      if (now - lastActivity > SESSION_TIMEOUT) {
        this.sessions.delete(userId);
        logger.info('Cleaned up inactive session', { userId });
      }
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Run cleanup every 5 minutes
setInterval(() => {
  sessionManager.cleanupInactiveSessions();
}, 5 * 60 * 1000);
