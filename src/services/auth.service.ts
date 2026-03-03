import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import type { User } from 'generated/prisma/client';
import { PrismaService } from 'src/repositories/prisma/prisma.service';
import { CognitoService } from './cognito.service';
import { AppErrorCode } from 'src/common/errors/app-error-code';
import {
  appBadRequest,
  appConflict,
  appInternal,
  appNotFound,
  appUnauthorized,
} from 'src/common/errors/app-http-exception';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cognitoService: CognitoService,
  ) {}

  googleLogin(redirectUri: string) {
    const state = encodeURIComponent(redirectUri ?? '');
    const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const callbackUrl = this.configService.get<string>(
      'GOOGLE_OAUTH_CALLBACK_URL',
    );

    if (!clientId || !callbackUrl) {
      throw appInternal(
        AppErrorCode.Internal,
        'Google OAuth configuration is missing',
      );
    }

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('openid email profile')}` +
      `&state=${state}` +
      `&access_type=offline` +
      `&prompt=select_account`;

    return authUrl;
  }

  /**
   * Exchange Google ID token for our JWT
   */
  async exchangeGoogleToken(idToken: string) {
    try {
      const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID');

      if (!idToken) {
        throw appBadRequest(AppErrorCode.BadRequest, 'Missing idToken');
      }

      const client = new OAuth2Client(clientId);

      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });

      const payload = ticket.getPayload();

      // find or create user in DB using `payload.sub` / `payload.email`
      const googleSub = payload?.sub;
      const email = payload?.email;

      let user: User | null = null;
      if (googleSub) {
        user = await this.prisma.user.findUnique({ where: { googleSub } });
      }
      if (!user && email) {
        user = await this.prisma.user.findUnique({ where: { email } });
      }

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            googleSub: googleSub ?? undefined,
            email: email ?? undefined,
            name: payload?.name ?? undefined,
            picture: payload?.picture ?? undefined,
            emailVerified: true,
          },
        });
      }

      // create access token (shorter lived)
      const accessToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        { expiresIn: '15m', algorithm: 'HS256' },
      );

      // create refresh token (longer lived)
      const refreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '7d', algorithm: 'HS256' },
      );

      return { status: 'ok', token: accessToken, refreshToken };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Google token exchange error', err);
      throw appUnauthorized(
        AppErrorCode.AuthInvalidToken,
        'Token verification failed',
      );
    }
  }

  async googleCallback(code: string, state: string) {
    try {
      const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID');
      const callbackUrl = this.configService.get<string>(
        'GOOGLE_OAUTH_CALLBACK_URL',
      );
      const clientSecret = this.configService.get<string>(
        'GOOGLE_OAUTH_CLIENT_SECRET',
      );

      if (!clientId || !clientSecret || !callbackUrl) {
        throw appInternal(
          AppErrorCode.Internal,
          'Google OAuth configuration is missing',
        );
      }

      const client = new OAuth2Client(clientId, clientSecret, callbackUrl);

      const { tokens } = await client.getToken(code);

      if (!tokens || !tokens.id_token) {
        console.error('No tokens returned from Google');
        throw appUnauthorized(
          AppErrorCode.AuthInvalidToken,
          'Authentication failed',
        );
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });

      const payload = ticket.getPayload();

      // find or create user in DB using `payload.sub` / `payload.email`
      const googleSub = payload?.sub;
      const email = payload?.email;

      let user: User | null = null;
      if (googleSub) {
        user = await this.prisma.user.findUnique({ where: { googleSub } });
      }
      if (!user && email) {
        user = await this.prisma.user.findUnique({ where: { email } });
      }

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            googleSub: googleSub ?? undefined,
            email: email ?? undefined,
            name: payload?.name ?? undefined,
            picture: payload?.picture ?? undefined,
            emailVerified: true,
          },
        });
      }

      // create access token (shorter lived)
      const accessToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        { expiresIn: '15m', algorithm: 'HS256' },
      );

      // create refresh token (longer lived)
      const refreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '7d', algorithm: 'HS256' },
      );

      const redirectTo = state
        ? decodeURIComponent(state)
        : (process.env.FRONTEND_URL ?? 'http://localhost:8081');
      const separator = redirectTo.includes('?') ? '&' : '?';

      return {
        accessToken,
        refreshToken,
        redirectTo,
        separator,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Google OAuth callback error', err);
      throw appInternal(AppErrorCode.Internal, 'Authentication error');
    }
  }

  /**
   * Sign up user with Cognito
   * Cognito will send OTP to user's email for verification
   */
  async register(email: string, password: string, name?: string) {
    if (!email || !password) {
      throw appBadRequest(
        AppErrorCode.BadRequest,
        'Email and password are required',
      );
    }

    // Check if user already exists in our DB
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw appConflict(
        AppErrorCode.EmailAlreadyRegistered,
        'Email already registered',
      );
    }

    // Sign up with Cognito
    const result = await this.cognitoService.signUp(email, password, name);

    return {
      status: 'ok',
      message:
        'Sign up successful. Please check your email to confirm the OTP code.',
      userSub: result.userSub,
      email: result.email,
    };
  }

  /**
   * Confirm OTP code from sign-up email
   */
  async confirmSignUp(email: string, code: string) {
    if (!email || !code) {
      throw appBadRequest(
        AppErrorCode.BadRequest,
        'Email and code are required',
      );
    }

    const result = await this.cognitoService.confirmSignUp(email, code);

    return {
      status: 'ok',
      message: 'Email confirmed successfully. You can now log in.',
      success: result.success,
    };
  }

  /**
   * Login with email and password using Cognito
   */
  async login(email: string, password: string) {
    if (!email || !password) {
      throw appBadRequest(
        AppErrorCode.BadRequest,
        'Email and password are required',
      );
    }

    // Validate credentials with Cognito (throws HttpExceptions on failure)
    await this.cognitoService.signIn(email, password);

    // Get user from database
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw appNotFound(AppErrorCode.UserNotFound, 'User not found');
    }

    // Create our own JWT token signed with backend secret
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
      },
      { expiresIn: '15m', algorithm: 'HS256' },
    );

    // Create refresh token
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d', algorithm: 'HS256' },
    );

    return {
      status: 'ok',
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        cognitoSub: user.cognitoSub,
      },
    };
  }

  /**
   * Initiate password reset via Cognito
   * Cognito will send OTP to user's email
   */
  async forgotPassword(email: string) {
    if (!email) {
      throw appBadRequest(AppErrorCode.BadRequest, 'Email is required');
    }

    // Initiate forgot password with Cognito.
    // For security (avoid user enumeration), always return OK even if the user
    // doesn't exist or the provider returns a not-found error.
    try {
      await this.cognitoService.forgotPassword(email);
    } catch (err) {
      console.warn('Forgot password provider error (masked)', err);
    }

    return {
      status: 'ok',
      message:
        'If an account with that email exists, you will receive a password reset code at your email address.',
    };
  }

  /**
   * Confirm forgot password with OTP code
   */
  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ) {
    if (!email || !code || !newPassword) {
      throw appBadRequest(
        AppErrorCode.BadRequest,
        'Email, confirmation code, and new password are required',
      );
    }

    if (newPassword.length < 6) {
      throw appBadRequest(
        AppErrorCode.BadRequest,
        'Password must be at least 6 characters',
      );
    }

    await this.cognitoService.confirmForgotPassword(email, code, newPassword);

    return {
      status: 'ok',
      message:
        'Password reset successfully. Please log in with your new password.',
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    if (!refreshToken) {
      throw appBadRequest(AppErrorCode.BadRequest, 'Refresh token is required');
    }

    // Verify the refresh token
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify<{ sub: string; type: string }>(
        refreshToken,
        {
          algorithms: ['HS256'],
        },
      );
    } catch (err) {
      console.warn('Token refresh verify failed', err);
      throw appUnauthorized(
        AppErrorCode.AuthInvalidToken,
        'Invalid or expired refresh token',
      );
    }

    // Check if it's a refresh token (has type: 'refresh')
    if (payload.type !== 'refresh') {
      throw appUnauthorized(
        AppErrorCode.AuthInvalidToken,
        'Invalid refresh token',
      );
    }

    // Get user from database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw appNotFound(AppErrorCode.UserNotFound, 'User not found');
    }

    // Create new access token
    const newAccessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
      { expiresIn: '15m', algorithm: 'HS256' },
    );

    // Create a new refresh token
    const newRefreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d', algorithm: 'HS256' },
    );

    return {
      status: 'ok',
      token: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
