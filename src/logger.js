import pino from 'pino';
import roll from 'pino-roll';

const isDevelopment = process.env.NODE_ENV !== 'production';
const LOG_DIR = process.env.LOG_DIR || './logs';

async function buildLogger() {
  const level = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

  if (isDevelopment) {
    return pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', singleLine: false }
      }
    });
  }

  const fileStream = await roll({
    file: `${LOG_DIR}/app.log`,
    frequency: 'daily',
    mkdir: true
  });

  const streams = pino.multistream([
    { stream: process.stdout },   // → docker logs видит это
    { stream: fileStream }        // → файл для хранения
  ]);

  return pino({ level }, streams);
}

export const logger = await buildLogger();
export const createChildLogger = (name) => logger.child({ module: name });
