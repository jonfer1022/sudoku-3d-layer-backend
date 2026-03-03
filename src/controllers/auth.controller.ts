import {
  Controller,
  Get,
  Query,
  Res,
  Post,
  Body,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from 'src/services';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Entry point used by the Expo app's `useAuthRequest` as the
   * `authorizationEndpoint`. Expo will open this URL; we then
   * redirect the browser to Google's OAuth2 authorization endpoint.
   *
   * The client (Expo) should pass its `redirect_uri` as a query
   * parameter; we preserve that value in the `state` parameter so
   * the callback can redirect back to the app with a token.
   */
  @Public()
  @Get('google/login')
  googleLogin(
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response,
  ) {
    const authUrl = this.authService.googleLogin(redirectUri);
    return res.redirect(authUrl);
  }

  /**
   * Accepts a Google ID token from a mobile/web client, verifies it with
   * Google, and returns a server-signed JWT for the application.
   */
  @Public()
  @Throttle({ auth: {} })
  @Post('google')
  async exchangeGoogleToken(@Body('idToken') idToken: string) {
    return this.authService.exchangeGoogleToken(idToken);
  }

  /**
   * Register a new user with email and password.
   */
  @Public()
  @Throttle({ auth: {} })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  /**
   * Confirm sign-up with OTP code sent to email
   */
  @Public()
  @Throttle({ auth: {} })
  @Post('confirm-signup')
  async confirmSignUp(
    @Body('email') email: string,
    @Body('code') code: string,
  ) {
    return this.authService.confirmSignUp(email, code);
  }

  /**
   * Login user with email and password.
   */
  @Public()
  @Throttle({ auth: {} })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * Request a password reset.
   */
  @Public()
  @Throttle({ auth: {} })
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  /**
   * Reset password using OTP code sent to email
   */
  @Public()
  @Throttle({ auth: {} })
  @Post('reset-password')
  async resetPassword(
    @Body('email') email: string,
    @Body('code') code: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.confirmForgotPassword(email, code, newPassword);
  }

  /**
   * Google will call this endpoint after the user selects an account.
   * We exchange the `code` for tokens, verify the `id_token`, create
   * a server-side JWT (or look up/create a user), and finally redirect
   * back to the original `redirect_uri` (passed via `state`) with the
   * signed token as a query parameter.
   */
  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken, redirectTo, separator } =
      await this.authService.googleCallback(code, state);
    return res.redirect(
      `${redirectTo}${separator}token=${accessToken}&refreshToken=${refreshToken}`,
    );
  }

  /**
   * Refresh access token using refresh token
   */
  @Public()
  @Throttle({ auth: {} })
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }
}
