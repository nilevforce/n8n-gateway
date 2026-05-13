import { Queue } from 'bullmq';
import { config } from './config.js';
import { createChildLogger } from './logger.js';
import IORedis from 'ioredis';

const queueLogger = createChildLogger('queue');

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

connection.on('connect', () => {
  queueLogger.info('Connected to Redis');
});

connection.on('error', (err) => {
  queueLogger.error({ error: err.message }, 'Redis connection error');
});

export const webhookQueue = new Queue('webhook-queue', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false
  }
});

queueLogger.info('Queue initialized');
