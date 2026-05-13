import { Worker } from 'bullmq';
import { config } from './config.js';
import { forwardToN8n } from './proxy.js';
import { pendingRequests } from './pending.js';
import { createChildLogger } from './logger.js';
import IORedis from 'ioredis';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
const workerLogger = createChildLogger('worker');

const worker = new Worker('webhook-queue', async (job) => {
  const jobLogger = workerLogger.child({ jobId: job.id, jobName: job.name });

  jobLogger.info({ attempt: job.attemptsMade + 1 }, 'Processing webhook');

  const result = await forwardToN8n(job.data);

  jobLogger.info({ status: result.status }, 'Webhook processed successfully');

  if (pendingRequests.has(job.id)) {
    const resolve = pendingRequests.get(job.id);
    resolve(result);
    pendingRequests.delete(job.id);
    jobLogger.debug('Result sent to pending request');
  }

  return result;
}, {
  connection,
  concurrency: config.concurrency,
  settings: {
    backoffStrategy: (attemptsMade) => {
      const delays = [0, 5000, 15000, 60000, 300000];
      return delays[attemptsMade] || -1;
    }
  }
});

worker.on('completed', (job) => {
  workerLogger.child({ jobId: job.id }).debug('Job completed');
});

worker.on('failed', (job, err) => {
  const jobLogger = workerLogger.child({ jobId: job.id, attempts: job.attemptsMade });
  jobLogger.error({ error: err.message, stack: err.stack }, 'Job failed');

  if (pendingRequests.has(job.id)) {
    const resolve = pendingRequests.get(job.id);
    resolve({ status: 502, body: 'Gateway Error: n8n unreachable', headers: {} });
    pendingRequests.delete(job.id);
    jobLogger.debug('Error response sent to pending request');
  }
});

worker.on('error', (err) => {
  workerLogger.error({ error: err.message }, 'Worker encountered an error');
});

workerLogger.info({ concurrency: config.concurrency }, 'Worker started');
