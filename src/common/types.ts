import { Request } from 'express';

export type Level = {
  id: string;
  level?: number | null;
  unlocked: boolean;
  stars: number;
  bestScore?: number;
  isCompleted?: boolean;
};

export type UserAuth = {
  sub?: string;
  email?: string;
  name?: string;
  token?: string;
  id?: string;
};

export type RequestAuth = Request & {
  user: UserAuth;
};
