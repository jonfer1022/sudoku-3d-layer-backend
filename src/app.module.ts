import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './repositories/prisma/prisma.module';
import {
  SudokuController,
  LevelsController,
  AuthController,
  GameScoreController,
  GameStateController,
} from './controllers';
import {
  SudokuService,
  LevelsService,
  AuthService,
  GameScoreService,
  // EmailService,
  CognitoService,
  GameStateService,
} from './services';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import googleOauthConfig from './common/config/google-auth.config';
import jwtConfig from './common/config/jwt.config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ConfigModule.forFeature(googleOauthConfig),
    PrismaModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');

        if (!secret) {
          throw new Error('JWT_SECRET environment variable is not set');
        }

        return {
          secret,
          signOptions: { algorithm: 'HS256' },
          verifyOptions: { algorithms: ['HS256'] },
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttl = Number(configService.get('RATE_LIMIT_TTL_SECONDS') ?? 60);
        const limit = Number(configService.get('RATE_LIMIT_LIMIT') ?? 120);

        const authTtl = Number(
          configService.get('AUTH_RATE_LIMIT_TTL_SECONDS') ?? 60,
        );
        const authLimit = Number(
          configService.get('AUTH_RATE_LIMIT_LIMIT') ?? 20,
        );

        return {
          throttlers: [
            { name: 'default', ttl, limit },
            { name: 'auth', ttl: authTtl, limit: authLimit },
          ],
        };
      },
    }),
  ],
  controllers: [
    SudokuController,
    LevelsController,
    AuthController,
    GameScoreController,
    GameStateController,
  ],
  providers: [
    SudokuService,
    LevelsService,
    AuthService,
    CognitoService,
    GameScoreService,
    // EmailService,
    GameStateService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    GoogleStrategy,
  ],
})
export class AppModule {}
