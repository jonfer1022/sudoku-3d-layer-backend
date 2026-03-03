import { HttpException, HttpStatus } from '@nestjs/common';
import type { AppErrorCode } from './app-error-code';

export type AppHttpExceptionBody = {
  status: 'error';
  code: AppErrorCode;
  message: string;
  details?: unknown;
};

export class AppHttpException extends HttpException {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(opts: {
    statusCode: number;
    code: AppErrorCode;
    message: string;
    details?: unknown;
  }) {
    const body: AppHttpExceptionBody = {
      status: 'error',
      code: opts.code,
      message: opts.message,
      ...(opts.details !== undefined ? { details: opts.details } : {}),
    };

    super(body, opts.statusCode);
    this.code = opts.code;
    this.details = opts.details;
  }
}

export const appBadRequest = (
  code: AppErrorCode,
  message: string,
  details?: unknown,
) =>
  new AppHttpException({
    statusCode: HttpStatus.BAD_REQUEST,
    code,
    message,
    details,
  });

export const appUnauthorized = (
  code: AppErrorCode,
  message: string,
  details?: unknown,
) =>
  new AppHttpException({
    statusCode: HttpStatus.UNAUTHORIZED,
    code,
    message,
    details,
  });

export const appForbidden = (
  code: AppErrorCode,
  message: string,
  details?: unknown,
) =>
  new AppHttpException({
    statusCode: HttpStatus.FORBIDDEN,
    code,
    message,
    details,
  });

export const appNotFound = (
  code: AppErrorCode,
  message: string,
  details?: unknown,
) =>
  new AppHttpException({
    statusCode: HttpStatus.NOT_FOUND,
    code,
    message,
    details,
  });

export const appConflict = (
  code: AppErrorCode,
  message: string,
  details?: unknown,
) =>
  new AppHttpException({
    statusCode: HttpStatus.CONFLICT,
    code,
    message,
    details,
  });

export const appInternal = (
  code: AppErrorCode,
  message: string,
  details?: unknown,
) =>
  new AppHttpException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code,
    message,
    details,
  });
