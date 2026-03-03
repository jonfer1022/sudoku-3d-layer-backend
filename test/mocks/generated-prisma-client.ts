// Jest-only mock to avoid loading the real generated Prisma client.

export class PrismaClient {
  // PrismaService extends PrismaClient; keep this class extendable.
  constructor() {}

  // Common lifecycle methods used by PrismaService.
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
}
