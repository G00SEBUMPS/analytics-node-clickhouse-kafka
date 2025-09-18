#!/usr/bin/env node

import { Command } from 'commander';
import { SQLiteManager } from '../db/sqlite';

const program = new Command();
const db = SQLiteManager.getInstance();

program
    .name('api-keys')
    .description('API key management tool')
    .version('1.0.0');

program.command('create')
    .description('Create a new API key')
    .requiredOption('-n, --name <name>', 'Name for the API key')
    .option('-r, --rate-limit-requests <number>', 'Number of requests allowed per window', '1000')
    .option('-w, --rate-limit-window <seconds>', 'Rate limit window in seconds', '3600')
    .option('-i, --allowed-ips <ips>', 'Comma-separated list of allowed IPs')
    .action(async (options) => {
        try {
            await db.initialize();
            
            const rateLimit = {
                requests: parseInt(options.rateLimitRequests),
                window: parseInt(options.rateLimitWindow)
            };
            
            const allowedIps = options.allowedIps ? options.allowedIps.split(',') : undefined;
            
            const apiKey = await db.createApiKey(options.name, rateLimit, allowedIps);
            
            console.log('\nAPI key created successfully:');
            console.log('------------------------');
            console.log('Name:', options.name);
            console.log('API Key:', apiKey);
            console.log('Rate Limit:', `${rateLimit.requests} requests per ${rateLimit.window} seconds`);
            if (allowedIps) {
                console.log('Allowed IPs:', allowedIps.join(', '));
            }
            
            await db.close();
        } catch (error) {
            console.error('Error creating API key:', error);
            process.exit(1);
        }
    });

program.command('list')
    .description('List all API keys')
    .action(async () => {
        try {
            await db.initialize();
            const keys = await db.listApiKeys();
            
            console.log('\nAPI Keys:');
            console.log('------------------------');
            keys.forEach(key => {
                console.log(`\nName: ${key.name}`);
                console.log(`API Key: ${key.key}`);
                console.log(`Rate Limit: ${key.rate_limit_requests} requests per ${key.rate_limit_window} seconds`);
                if (key.allowed_ips) {
                    console.log(`Allowed IPs: ${JSON.parse(key.allowed_ips).join(', ')}`);
                }
                console.log(`Created: ${key.created_at}`);
                console.log(`Status: ${key.active ? 'Active' : 'Inactive'}`);
            });
            
            await db.close();
        } catch (error) {
            console.error('Error listing API keys:', error);
            process.exit(1);
        }
    });

program.command('revoke')
    .description('Revoke an API key')
    .requiredOption('-k, --key <apiKey>', 'API key to revoke')
    .action(async (options) => {
        try {
            await db.initialize();
            await db.revokeApiKey(options.key);
            console.log('\nAPI key revoked successfully');
            await db.close();
        } catch (error) {
            console.error('Error revoking API key:', error);
            process.exit(1);
        }
    });

program.parse();