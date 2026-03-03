export const AppErrorCode = {
  BadRequest: 'BAD_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  Internal: 'INTERNAL_ERROR',

  AuthMissingToken: 'AUTH_MISSING_TOKEN',
  AuthInvalidToken: 'AUTH_INVALID_TOKEN',

  SudokuNotFound: 'SUDOKU_NOT_FOUND',
  UserNotFound: 'USER_NOT_FOUND',
  EmailAlreadyRegistered: 'EMAIL_ALREADY_REGISTERED',
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];
