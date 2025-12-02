import { Request, Response, NextFunction } from 'express';

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  const originalLog = req.log;
  req.log = originalLog.child({ requestId: req.id });

  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any, cb?: any): Response {
    const duration = Date.now() - startTime;

    req.log.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    }, 'Request completed');

    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
}
