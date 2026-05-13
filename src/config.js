import { createChildLogger } from './logger.js';

const configLogger = createChildLogger('config');

function validateConfig() {
  const required = ['N8N_URL', 'REDIS_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    configLogger.error({ missing }, 'Missing required environment variables');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();

export const config = {
  n8nUrl: process.env.N8N_URL,
  redisUrl: process.env.REDIS_URL,
  concurrency: parseInt(process.env.CONCURRENCY || '25', 10),
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
};

configLogger.debug(config, 'Configuration loaded successfully');
