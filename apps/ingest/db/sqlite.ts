import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { Logger } from '../logger.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = new Logger('sqlite-manager');

export class SQLiteManager {
    private static instance: SQLiteManager;
    private db: Database | null = null;

    private constructor() {}

    static getInstance(): SQLiteManager {
        if (!SQLiteManager.instance) {
            SQLiteManager.instance = new SQLiteManager();
        }
        return SQLiteManager.instance;
    }

    async initialize(): Promise<void> {
        try {
            const dbPath = path.join(__dirname, 'analytics.db');
            this.db = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });

            await this.createTables();
            logger.info('SQLite database initialized');
        } catch (error) {
            logger.error('Failed to initialize SQLite database', error);
            throw error;
        }
    }

    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Create API keys table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                active INTEGER DEFAULT 1,
                allowed_ips TEXT,
                rate_limit_requests INTEGER NOT NULL,
                rate_limit_window INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create rate limit counters table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS rate_limit_counters (
                api_key_id TEXT,
                window_start TEXT,
                request_count INTEGER DEFAULT 0,
                PRIMARY KEY (api_key_id, window_start),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
            )
        `);

        logger.info('Database tables created');
    }

    async createApiKey(name: string, rateLimit: { requests: number; window: number }, allowedIps?: string[]): Promise<string> {
        if (!this.db) throw new Error('Database not initialized');

        const apiKey = require('crypto').randomBytes(32).toString('hex');
        const id = require('crypto').randomBytes(16).toString('hex');

        await this.db.run(
            `INSERT INTO api_keys (id, key, name, allowed_ips, rate_limit_requests, rate_limit_window)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, apiKey, name, allowedIps ? JSON.stringify(allowedIps) : null, rateLimit.requests, rateLimit.window]
        );

        return apiKey;
    }

    async getApiKey(key: string): Promise<{
        id: string;
        name: string;
        allowedIps?: string[];
        rateLimit: { requests: number; window: number };
    } | null> {
        if (!this.db) throw new Error('Database not initialized');

        const row = await this.db.get(
            `SELECT id, name, allowed_ips, rate_limit_requests, rate_limit_window
             FROM api_keys 
             WHERE key = ? AND active = 1`,
            [key]
        );

        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            allowedIps: row.allowed_ips ? JSON.parse(row.allowed_ips) : undefined,
            rateLimit: {
                requests: row.rate_limit_requests,
                window: row.rate_limit_window
            }
        };
    }

    async updateRateLimitCounter(apiKeyId: string, requestCount: number): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const windowStart = new Date().toISOString().slice(0, 13) + ':00:00'; // Round to hour

        await this.db.run(
            `INSERT INTO rate_limit_counters (api_key_id, window_start, request_count)
             VALUES (?, ?, ?)
             ON CONFLICT(api_key_id, window_start) 
             DO UPDATE SET request_count = ?`,
            [apiKeyId, windowStart, requestCount, requestCount]
        );
    }

    async listApiKeys(): Promise<any[]> {
        if (!this.db) throw new Error('Database not initialized');

        return this.db.all(
            `SELECT key, name, allowed_ips, rate_limit_requests, rate_limit_window, created_at, active
             FROM api_keys
             ORDER BY created_at DESC`
        );
    }

    async revokeApiKey(key: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.run(
            `UPDATE api_keys SET active = 0, updated_at = CURRENT_TIMESTAMP
             WHERE key = ?`,
            [key]
        );
    }

    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}