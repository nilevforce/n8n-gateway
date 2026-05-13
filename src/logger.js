import pino from 'pino';
import roll from 'pino-roll';

const isDevelopment = process.env.NODE_ENV !== 'production';
const LOG_DIR = process.env.LOG_DIR || './logs';

async function buildLogger() {
  const logStream = await roll({
    file: `${LOG_DIR}/app.log`,
    frequency: 'daily',
    size: null,
    mkdir: true
  });

  return pino(
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
    isDevelopment ? undefined : logStream  // <-- в dev pino-pretty сам управляет стримом
  );
}

export const logger = await buildLogger();

export const createChildLogger = (name) =>
  logger.child({ module: name });
