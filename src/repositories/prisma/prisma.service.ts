import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  adapter: PrismaPg;

  constructor() {
    const connectionString: string = process.env.DATABASE_URL || '';

    const adapter: PrismaPg = new PrismaPg({
      connectionString,
    });

    super({
      adapter: adapter,
      log: [
        {
          emit: 'stdout' as const,
          level: 'query' as const,
        },
        {
          emit: 'stdout' as const,
          level: 'error' as const,
        },
        {
          emit: 'stdout' as const,
          level: 'warn' as const,
        },
      ],
    });

    this.adapter = adapter;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
