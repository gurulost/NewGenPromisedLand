export interface RequestContext {
  requestId?: string;
  sessionId?: string;
  playerId?: string;
  gameId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

const formatContext = (context?: Record<string, any>) =>
  context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";

export const logger = {
  info: (message: string, context?: Record<string, any>) =>
    console.log(`[info] ${message}${formatContext(context)}`),
  warn: (message: string, context?: Record<string, any>) =>
    console.warn(`[warn] ${message}${formatContext(context)}`),
  error: (message: string, context?: Record<string, any>) =>
    console.error(`[error] ${message}${formatContext(context)}`),
  debug: (message: string, context?: Record<string, any>) =>
    console.debug(`[debug] ${message}${formatContext(context)}`),
};

export class RequestLogger {
  private context: RequestContext;

  constructor(context: Partial<RequestContext> = {}) {
    this.context = context;
  }

  info(message: string, data?: Record<string, unknown>) {
    logger.info(message, { ...this.context, ...data });
  }

  warn(message: string, data?: Record<string, unknown>) {
    logger.warn(message, { ...this.context, ...data });
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    logger.error(message, { ...this.context, error, ...data });
  }

  debug(message: string, data?: Record<string, unknown>) {
    logger.debug(message, { ...this.context, ...data });
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
    requestId: req.headers?.['x-request-id'],
    sessionId: req.headers?.['x-session-id'],
    playerId: req.session?.playerId || req.user?.id,
    ip: req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
  });
}

export default logger;
