import 'dotenv/config.js';

import Fastify from 'fastify';
import { webhookQueue } from './queue.js';
import { pendingRequests } from './pending.js';
import { config } from './config.js';
import { logger, createChildLogger } from './logger.js';
import './worker.js';
import IORedis from 'ioredis';

const serverLogger = createChildLogger('server');
const fastify = Fastify({
  loggerInstance: logger
});

// Создаем отдельное соединение для health check
const healthCheckRedis = new IORedis(config.redisUrl);

// Health check эндпоинт
fastify.get('/health', async (request, reply) => {
  try {
    // Проверяем подключение к Redis
    const redisConnection = await healthCheckRedis.ping();

    // Проверяем статус очереди
    const queueCount = await webhookQueue.count();

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      redis: redisConnection === 'PONG' ? 'connected' : 'disconnected',
      queueSize: queueCount,
      uptime: process.uptime()
    };

    serverLogger.debug(health, 'Health check');
    return reply.status(200).send(health);
  } catch (err) {
    serverLogger.error(err, 'Health check failed');
    return reply.status(503).send({ status: 'unhealthy', error: err.message });
  }
});

fastify.all('/webhook/*', async (request, reply) => {
  const requestId = request.id;
  const reqLogger = serverLogger.child({ requestId, path: request.url, method: request.method });

  reqLogger.info('Sync webhook received');

  const job = await webhookQueue.add('sync-webhook', {
    method: request.method,
    path: request.url,
    headers: request.headers,
    body: request.body
  }, { priority: 1 });

  reqLogger.debug({ jobId: job.id }, 'Job added to queue');

  const result = await new Promise((resolve) => {
    pendingRequests.set(job.id, resolve);
    setTimeout(() => {
      if (pendingRequests.has(job.id)) {
        reqLogger.warn({ jobId: job.id }, 'Request timeout - no response from worker');
        pendingRequests.delete(job.id);
        resolve({ status: 504, body: 'Gateway Timeout', headers: {} });
      }
    }, 30000);
  });

  reqLogger.info({ status: result.status, jobId: job.id }, 'Response sent');

  return reply
    .status(result.status)
    .headers(result.headers)
    .send(result.body);
});

fastify.all('/webhook-async/*', async (request, reply) => {
  const requestId = request.id;
  const reqLogger = serverLogger.child({ requestId, path: request.url, method: request.method });

  reqLogger.info('Async webhook received');

  const job = await webhookQueue.add('async-webhook', {
    method: request.method,
    path: request.url,
    headers: request.headers,
    body: request.body
  }, {
    priority: 10,
    attempts: 5,
    backoff: { type: 'custom' }
  });

  reqLogger.debug({ jobId: job.id }, 'Job queued for async processing');

  return reply.status(202).send({ status: 'queued', jobId: job.id });
});

fastify.listen({ port: config.port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    serverLogger.error(err, 'Failed to start server');
    process.exit(1);
  }
  serverLogger.info(`Server listening on ${address}`);
});
