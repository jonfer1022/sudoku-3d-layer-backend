import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { NestExpressApplication } from '@nestjs/platform-express';

function parseCorsOrigins(): string[] {
  const env = process.env.CORS_ORIGINS;
  if (env && env.trim().length > 0) {
    return env
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Reasonable defaults for local development + known frontend URLs.
  return [
    process.env.FRONTEND_URL,
    process.env.EXPO_PUBLIC_BASE_URL,
    'http://localhost:19006',
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.TRUST_PROXY === 'true') {
    // Needed when running behind a reverse proxy (ALB/Cloudflare/etc.) so
    // `req.ip` uses X-Forwarded-For for rate limiting.
    app.set('trust proxy', 1);
  }

  const allowedOrigins = parseCorsOrigins();
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header), e.g. mobile apps, curl.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Set to true only if you use cookies/HTTP auth that requires it.
    credentials: false,
    optionsSuccessStatus: 204,
  };
  app.enableCors(corsOptions);

  // Enable global validation pipe to use class-validator on DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
