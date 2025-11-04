import pino from 'pino';
import { nanoid } from 'nanoid';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export interface RequestContext {
  requestId?: string;
  sessionId?: string;
  playerId?: string;
  gameId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export class RequestLogger {
  private context: RequestContext;

  constructor(context: Partial<RequestContext> = {}) {
    this.context = {
      requestId: context.requestId || nanoid(),
      ...context,
    };
  }

  info(message: string, data?: Record<string, unknown>) {
    logger.info({ ...this.context, ...data }, message);
  }

  warn(message: string, data?: Record<string, unknown>) {
    logger.warn({ ...this.context, ...data }, message);
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    const errorData = error instanceof Error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        }
      : { error };

    logger.error({ ...this.context, ...errorData, ...data }, message);
  }

  debug(message: string, data?: Record<string, unknown>) {
    logger.debug({ ...this.context, ...data }, message);
  }

  child(additionalContext: Partial<RequestContext>) {
    return new RequestLogger({ ...this.context, ...additionalContext });
  }

  getContext() {
    return { ...this.context };
  }
}

export function createRequestLogger(req: any): RequestLogger {
  return new RequestLogger({
    requestId: req.headers['x-request-id'] || nanoid(),
    sessionId: req.headers['x-session-id'] || req.session?.id,
    playerId: req.session?.playerId || req.user?.id,
    ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
}

export default logger;
