import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorResponseBody = {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getPrismaInfo(exception: unknown):
  | {
      prismaCode?: string;
      meta?: unknown;
    }
  | undefined {
  if (!isObject(exception)) return undefined;
  const name = typeof exception.name === 'string' ? exception.name : undefined;
  if (!name || !name.startsWith('Prisma')) return undefined;

  const prismaCode =
    typeof exception.code === 'string' ? exception.code : undefined;
  const meta = exception.meta;
  return { prismaCode, meta };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const now = new Date().toISOString();
    const path = request?.url ?? '';

    // Prisma mapping (best-effort; do not rely on runtime types)
    const prisma = getPrismaInfo(exception);
    if (prisma?.prismaCode) {
      if (prisma.prismaCode === 'P2002') {
        const body: ErrorResponseBody = {
          status: 'error',
          code: 'CONFLICT',
          message: 'Unique constraint violation',
          details: prisma.meta,
          path,
          timestamp: now,
        };
        return response.status(HttpStatus.CONFLICT).json(body);
      }

      if (prisma.prismaCode === 'P2025') {
        const body: ErrorResponseBody = {
          status: 'error',
          code: 'NOT_FOUND',
          message: 'Record not found',
          details: prisma.meta,
          path,
          timestamp: now,
        };
        return response.status(HttpStatus.NOT_FOUND).json(body);
      }
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();

      // If the exception already uses our envelope, pass through (and add path/timestamp).
      if (isObject(res) && res.status === 'error') {
        const body: ErrorResponseBody = {
          status: 'error',
          code: typeof res.code === 'string' ? res.code : 'ERROR',
          message:
            typeof res.message === 'string'
              ? res.message
              : Array.isArray(res.message)
                ? res.message.join(', ')
                : 'Request failed',
          ...(res.details !== undefined ? { details: res.details } : {}),
          path,
          timestamp: now,
        };
        return response.status(statusCode).json(body);
      }

      // Nest default HttpException shapes
      let message = 'Request failed';
      let details: unknown = undefined;

      if (typeof res === 'string') {
        message = res;
      } else if (isObject(res)) {
        const m = res.message;
        if (typeof m === 'string') message = m;
        else if (Array.isArray(m)) message = m.join(', ');
        else if (typeof res.error === 'string') message = res.error;
        details = res;
      }

      const code =
        statusCode === 400
          ? 'BAD_REQUEST'
          : statusCode === 401
            ? 'UNAUTHORIZED'
            : statusCode === 403
              ? 'FORBIDDEN'
              : statusCode === 404
                ? 'NOT_FOUND'
                : statusCode === 409
                  ? 'CONFLICT'
                  : 'ERROR';

      const body: ErrorResponseBody = {
        status: 'error',
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        path,
        timestamp: now,
      };

      return response.status(statusCode).json(body);
    }

    // Unknown/unhandled errors
    // Log once here to avoid scattered duplicate logs.
    console.error('Unhandled exception', exception);

    const body: ErrorResponseBody = {
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      path,
      timestamp: now,
    };
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
