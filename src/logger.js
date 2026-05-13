import pino from 'pino';
import roll from 'pino-roll';

const isDevelopment = process.env.NODE_ENV !== 'production';

const LOG_DIR = process.env.LOG_DIR || './logs';

const logStream = roll({
  file: `${LOG_DIR}/app.log`,
  frequency: 'daily',
  size: null,
  mkdir: true
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            singleLine: false
          }
        }
      : undefined
  },
  logStream
);

export const createChildLogger = (name) =>
  logger.child({ module: name });
