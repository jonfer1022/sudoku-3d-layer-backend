import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';
import type pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  adapter: PrismaPg;

  constructor() {
    const connectionString: string = process.env.DATABASE_URL || '';

    const poolConfig: pg.PoolConfig = {
      connectionString,
    };

    // Render Postgres requires SSL for external connections. Prisma's JS driver
    // adapter uses node-postgres, so we need to enable SSL explicitly.
    try {
      const url = new URL(connectionString);
      const sslmode = url.searchParams.get('sslmode');
      const sslParam = url.searchParams.get('ssl');
      const host = url.hostname;

      const needsSsl =
        sslParam === 'true' ||
        sslParam === '1' ||
        (sslmode !== null && sslmode !== '' && sslmode !== 'disable') ||
        host.endsWith('.render.com');

      if (needsSsl) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        poolConfig.ssl = { rejectUnauthorized: false };
      }
    } catch {
      console.warn(
        'Could not parse DATABASE_URL for SSL configuration. Ensure it is a valid URL.',
      );
      // If DATABASE_URL is malformed, let Prisma surface the connection error.
    }

    const adapter: PrismaPg = new PrismaPg(poolConfig);

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
