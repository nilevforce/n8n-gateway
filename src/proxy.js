import { request } from 'undici';
import { config } from './config.js';
import { createChildLogger } from './logger.js';

const proxyLogger = createChildLogger('proxy');

export async function forwardToN8n(jobData) {
  const { method, path, headers, body } = jobData;
  const targetPath = path.replace(/^\/webhook-async\//, '/webhook/');
  const url = `${config.n8nUrl}${targetPath}`;

  const reqLogger = proxyLogger.child({ method, targetPath, url });
  reqLogger.debug('Forwarding request to n8n');

  try {
    const { host, 'content-length': _cl, ...cleanHeaders } = headers;

    const response = await request(url, {
      method,
      headers: cleanHeaders,
      body: body ?? undefined,
    });

    const responseBody = await response.body.text();

    reqLogger.info({ statusCode: response.statusCode }, 'Received response from n8n');

    return {
      status: response.statusCode,
      headers: response.headers,
      body: responseBody
    };
  } catch (err) {
    reqLogger.error({ error: err.message, code: err.code }, 'Failed to reach n8n');
    throw err;
  }
}
