const sendMock = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  class CognitoIdentityProviderClient {
    send = sendMock;
    constructor() {}
  }

  class SignUpCommand {
    constructor(public input: any) {}
  }
  class ConfirmSignUpCommand {
    constructor(public input: any) {}
  }
  class InitiateAuthCommand {
    constructor(public input: any) {}
  }
  class ForgotPasswordCommand {
    constructor(public input: any) {}
  }
  class ConfirmForgotPasswordCommand {
    constructor(public input: any) {}
  }
  class AdminGetUserCommand {
    constructor(public input: any) {}
  }
  class GlobalSignOutCommand {
    constructor(public input: any) {}
  }
  class GetUserCommand {
    constructor(public input: any) {}
  }

  return {
    CognitoIdentityProviderClient,
    SignUpCommand,
    ConfirmSignUpCommand,
    InitiateAuthCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
    AdminGetUserCommand,
    GlobalSignOutCommand,
    GetUserCommand,
  };
});

import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { CognitoService } from './cognito.service';

describe('CognitoService', () => {
  const make = () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'AWS_COGNITO_REGION') return 'us-east-1';
        if (key === 'AWS_COGNITO_USER_POOL_ID') return 'pool';
        if (key === 'AWS_COGNITO_CLIENT_ID') return 'client';
        if (key === 'AWS_ACCESS_KEY_ID') return 'k';
        if (key === 'AWS_SECRET_ACCESS_KEY') return 's';
        throw new Error('missing');
      }),
      get: jest.fn(() => undefined),
    } as any;

    const prismaService = {
      user: {
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    const service = new CognitoService(configService, prismaService);
    return { service, prismaService, configService };
  };

  beforeEach(() => {
    sendMock.mockReset();
  });

  it('signUp returns userSub and creates DB user', async () => {
    const { service, prismaService } = make();
    sendMock.mockResolvedValue({ UserSub: 'sub-1' });

    const res = await service.signUp('a@b.com', 'Password1!', 'A');
    expect(res).toEqual({ userSub: 'sub-1', email: 'a@b.com' });
    expect(prismaService.user.create).toHaveBeenCalled();
  });

  it('signUp throws ConflictException when UsernameExistsException', async () => {
    const { service } = make();
    const err = Object.assign(new Error('exists'), {
      name: 'UsernameExistsException',
    });
    sendMock.mockRejectedValue(err);
    await expect(
      service.signUp('a@b.com', 'Password1!'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirmSignUp updates DB user verified', async () => {
    const { service, prismaService } = make();
    sendMock.mockResolvedValue({});

    await expect(service.confirmSignUp('a@b.com', '1234')).resolves.toEqual({
      success: true,
    });
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
      data: { emailVerified: true },
    });
  });

  it('signIn throws UnauthorizedException when AuthenticationResult missing', async () => {
    const { service } = make();
    sendMock.mockResolvedValue({});
    await expect(
      service.signIn('a@b.com', 'Password1!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('signIn returns tokens when AuthenticationResult present', async () => {
    const { service } = make();
    sendMock.mockResolvedValue({
      AuthenticationResult: {
        IdToken: 'id',
        AccessToken: 'access',
        RefreshToken: 'refresh',
        ExpiresIn: 123,
      },
    });

    const res = await service.signIn('a@b.com', 'Password1!');
    expect(res).toEqual({
      idToken: 'id',
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 123,
    });
  });

  it('forgotPassword throws BadRequestException when CodeDeliveryDetails missing', async () => {
    const { service } = make();
    sendMock.mockResolvedValue({});
    await expect(service.forgotPassword('a@b.com')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('forgotPassword returns codeDeliveryDetails when present', async () => {
    const { service } = make();
    sendMock.mockResolvedValue({
      CodeDeliveryDetails: { Destination: 'a@b.com' },
    });

    const res = await service.forgotPassword('a@b.com');
    expect(res).toHaveProperty('codeDeliveryDetails');
  });

  it('confirmForgotPassword returns success true', async () => {
    const { service } = make();
    sendMock.mockResolvedValue({});
    await expect(
      service.confirmForgotPassword('a@b.com', '1234', 'Password1!'),
    ).resolves.toEqual({ success: true });
  });

  it('signOut returns success true', async () => {
    const { service } = make();
    sendMock.mockResolvedValue({});
    await expect(service.signOut('access')).resolves.toEqual({ success: true });
  });

  it('validateToken returns parsed user attributes', async () => {
    const { service } = make();
    sendMock.mockResolvedValue({
      Username: 'sub',
      UserAttributes: [
        { Name: 'email', Value: 'a@b.com' },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: 'A' },
        { Name: 'sub', Value: 'sub' },
      ],
    });

    const res = await service.validateToken('access');
    expect(res).toEqual({
      sub: 'sub',
      email: 'a@b.com',
      email_verified: true,
      name: 'A',
    });
  });

  it('validateToken throws UnauthorizedException on provider failure', async () => {
    const { service } = make();
    sendMock.mockRejectedValue(new Error('bad'));
    await expect(service.validateToken('access')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('getUserBySub returns null when UserNotFoundException', async () => {
    const { service } = make();
    const err = Object.assign(new Error('not found'), {
      name: 'UserNotFoundException',
    });
    sendMock.mockRejectedValue(err);

    await expect(service.getUserBySub('sub')).resolves.toBeNull();
  });

  it('getUserBySub returns user when provider succeeds', async () => {
    const { service } = make();
    sendMock.mockResolvedValue({
      UserAttributes: [
        { Name: 'email', Value: 'a@b.com' },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: 'A' },
      ],
    });

    const res = await service.getUserBySub('sub');
    expect(res).toEqual({
      sub: 'sub',
      email: 'a@b.com',
      email_verified: true,
      name: 'A',
    });
  });
});
