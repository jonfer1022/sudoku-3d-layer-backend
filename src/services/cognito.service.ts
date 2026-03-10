import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminGetUserCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  CodeDeliveryDetailsType,
} from '@aws-sdk/client-cognito-identity-provider';
import { PrismaService } from 'src/repositories/prisma/prisma.service';

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

interface CognitoUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

@Injectable()
export class CognitoService {
  private cognitoClient: CognitoIdentityProviderClient;
  private userPoolId: string;
  private clientId: string;
  private clientSecret?: string;
  private region: string;

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    this.region = this.configService.getOrThrow<string>('AWS_COGNITO_REGION');
    this.userPoolId = this.configService.getOrThrow<string>(
      'AWS_COGNITO_USER_POOL_ID',
    );
    this.clientId = this.configService.getOrThrow<string>(
      'AWS_COGNITO_CLIENT_ID',
    );
    // this.clientSecret = this.configService.get<string>(
    //   'AWS_COGNITO_CLIENT_SECRET',
    // );

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.region,
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          }
        : {}),
    });
  }

  /**
   * Sign up a new user with email and password
   * Cognito will automatically send an OTP to the user's email
   */
  async signUp(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ userSub: string; email: string }> {
    try {
      const secretHash = this.computeSecretHash(email);

      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          {
            Name: 'email',
            Value: email,
          },
          ...(name ? [{ Name: 'name', Value: name }] : []),
        ],
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      const response = await this.cognitoClient.send(command);

      // Create user record in database with cognitoSub
      await this.prismaService.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          cognitoSub: response.UserSub,
          emailVerified: false,
          picture: null,
        },
      });

      return {
        userSub: response.UserSub || '',
        email,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'UsernameExistsException') {
          throw new ConflictException('Email already registered');
        }
        throw new BadRequestException(`Sign up failed: ${error.message}`);
      }
      throw new BadRequestException('Sign up failed');
    }
  }

  /**
   * Confirm sign up with OTP code sent to email
   */
  async confirmSignUp(
    email: string,
    code: string,
  ): Promise<{ success: boolean }> {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      await this.cognitoClient.send(command);

      // Update user record to mark email as verified
      await this.prismaService.user.update({
        where: { email },
        data: { emailVerified: true },
      });

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `OTP confirmation failed: ${error.message}`,
        );
      }
      throw new BadRequestException('OTP confirmation failed');
    }
  }

  /**
   * Sign in user with email and password
   * Returns JWT tokens from Cognito
   */
  async signIn(email: string, password: string): Promise<AuthTokens> {
    try {
      const secretHash = this.computeSecretHash(email);
      const authParams: Record<string, string> = {
        USERNAME: email,
        PASSWORD: password,
      };

      if (secretHash) authParams.SECRET_HASH = secretHash;

      const command = new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: authParams,
      });

      const response = await this.cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('Authentication failed');
      }

      return {
        idToken: response.AuthenticationResult.IdToken || '',
        accessToken: response.AuthenticationResult.AccessToken || '',
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Invalid email or password');
        }
        if (error.name === 'UserNotConfirmedException') {
          throw new BadRequestException(
            'Email not verified. Please confirm your email first.',
          );
        }
      }
      throw new UnauthorizedException('Sign in failed');
    }
  }

  /**
   * Initiate forgot password flow
   * Cognito will send OTP to user's email
   */
  async forgotPassword(
    email: string,
  ): Promise<{ codeDeliveryDetails: CodeDeliveryDetailsType | undefined }> {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      const response = await this.cognitoClient.send(command);

      if (!response.CodeDeliveryDetails) {
        throw new BadRequestException('Failed to send OTP');
      }

      return {
        codeDeliveryDetails: response.CodeDeliveryDetails,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          // Don't reveal if user exists
          throw new BadRequestException('User not found');
        }
        throw new BadRequestException(
          `Forgot password failed: ${error.message}`,
        );
      }
      throw new BadRequestException('Forgot password failed');
    }
  }

  /**
   * Confirm forgot password with OTP code and new password
   */
  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      await this.cognitoClient.send(command);

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          // Don't reveal if user exists
          throw new BadRequestException('User not found');
        }
        throw new BadRequestException(
          `Password reset failed: ${error.message}`,
        );
      }
      throw new BadRequestException('Password reset failed');
    }
  }

  /**
   * Sign out user (global sign out from all devices)
   */
  async signOut(accessToken: string): Promise<{ success: boolean }> {
    try {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken,
      });

      await this.cognitoClient.send(command);

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new UnauthorizedException(`Sign out failed: ${error.message}`);
      }
      throw new UnauthorizedException('Sign out failed');
    }
  }

  /**
   * Validate and get user information from access token
   */
  async validateToken(accessToken: string): Promise<CognitoUser> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.cognitoClient.send(command);

      const userAttributes = response.UserAttributes || [];
      const user: CognitoUser = {
        sub: response.Username || '',
        email: '',
        email_verified: false,
        name: '',
      };

      for (const attr of userAttributes) {
        if (attr.Name === 'email') user.email = attr.Value || '';
        if (attr.Name === 'email_verified')
          user.email_verified = attr.Value === 'true';
        if (attr.Name === 'name') user.name = attr.Value;
        if (attr.Name === 'sub') user.sub = attr.Value || '';
      }

      return user;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new UnauthorizedException(
          `Token validation failed: ${error.message}`,
        );
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  /**
   * Get user by Cognito sub (user ID)
   */
  async getUserBySub(sub: string): Promise<CognitoUser | null> {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: sub,
      });

      const response = await this.cognitoClient.send(command);

      const userAttributes = response.UserAttributes || [];
      const user: CognitoUser = {
        sub,
        email: '',
        email_verified: false,
        name: '',
      };

      for (const attr of userAttributes) {
        if (attr.Name === 'email') user.email = attr.Value || '';
        if (attr.Name === 'email_verified')
          user.email_verified = attr.Value === 'true';
        if (attr.Name === 'name') user.name = attr.Value;
      }

      return user;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'UserNotFoundException') {
        return null;
      }
      throw new BadRequestException(
        `Get user failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Compute Cognito SECRET_HASH when a client secret is configured.
   * See: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-client-settings.html
   */
  private computeSecretHash(username: string): string | undefined {
    if (!this.clientSecret) return undefined;
    try {
      const hmac = createHmac('sha256', this.clientSecret);
      hmac.update(username + this.clientId);
      return hmac.digest('base64');
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new Error(
          `Failed to compute Cognito secret hash: ${err.message}`,
        );
      }
      // If crypto fails for any reason, return undefined and let calls proceed without secret
    }
  }
}
