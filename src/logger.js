import pino from 'pino';
import roll from 'pino-roll';

const isDevelopment = process.env.NODE_ENV !== 'production';

const logStream = roll({
  file: './logs/app.log',
  frequency: 'daily', // 👈 ротация каждый день
  size: null,         // можно указать лимит типа '10m' если нужно
  mkdir: true         // создаст папку logs автоматически
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
