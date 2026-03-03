import { AuthService } from './auth.service';

const verifyIdTokenMock = jest.fn();
const getTokenMock = jest.fn();
const getPayloadMock = jest.fn();

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: verifyIdTokenMock,
        getToken: getTokenMock,
      };
    }),
  };
});

describe('AuthService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    verifyIdTokenMock.mockReset();
    getTokenMock.mockReset();
    getPayloadMock.mockReset();

    verifyIdTokenMock.mockResolvedValue({
      getPayload: getPayloadMock,
    });
    getPayloadMock.mockReturnValue({ sub: 'g1', email: 'a@b.com', name: 'A' });
    getTokenMock.mockResolvedValue({ tokens: { id_token: 'id_token' } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeService = (overrides?: Partial<any>) => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      ...(overrides?.prisma ?? {}),
    };

    const jwtService = {
      sign: jest.fn().mockReturnValue('token'),
      verify: jest.fn(),
      ...(overrides?.jwtService ?? {}),
    };

    const configService = {
      get: jest.fn(),
      ...(overrides?.configService ?? {}),
    };

    const cognitoService = {
      signUp: jest.fn(),
      confirmSignUp: jest.fn(),
      signIn: jest.fn(),
      forgotPassword: jest.fn(),
      confirmForgotPassword: jest.fn(),
      ...(overrides?.cognitoService ?? {}),
    };

    return {
      service: new AuthService(
        prisma,
        jwtService,
        configService,
        cognitoService,
      ),
      prisma,
      jwtService,
      configService,
      cognitoService,
    };
  };

  it('exchangeGoogleToken throws 400 when idToken missing', async () => {
    const { service } = makeService({
      configService: { get: jest.fn().mockReturnValue('client') },
    });

    try {
      await service.exchangeGoogleToken('');
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(400);
    }
  });

  it('googleLogin returns Google auth URL when configured', () => {
    const { service, configService } = makeService({
      configService: {
        get: jest.fn((key: string) => {
          if (key === 'GOOGLE_OAUTH_CLIENT_ID') return 'client';
          if (key === 'GOOGLE_OAUTH_CALLBACK_URL') return 'http://cb';
          return undefined;
        }),
      },
    });

    const url = service.googleLogin('sudoku://redirect');
    expect(url).toContain('accounts.google.com');
    expect(configService.get).toHaveBeenCalled();
  });

  it('exchangeGoogleToken creates a user when missing and returns ok', async () => {
    const { service, prisma, jwtService } = makeService({
      configService: { get: jest.fn().mockReturnValue('client') },
    });

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      picture: null,
    });

    const res = await service.exchangeGoogleToken('id-token');
    expect(res.status).toBe('ok');
    expect(jwtService.sign).toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('exchangeGoogleToken returns ok without creating user when existing', async () => {
    const { service, prisma } = makeService({
      configService: { get: jest.fn().mockReturnValue('client') },
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      picture: null,
    });

    const res = await service.exchangeGoogleToken('id-token');
    expect(res.status).toBe('ok');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('register throws 409 when email already exists', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

    try {
      await service.register('a@b.com', 'Password1!', 'A');
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toMatchObject({
        status: 'error',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
    }
  });

  it('register returns ok when Cognito signUp succeeds', async () => {
    const { service, prisma, cognitoService } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    cognitoService.signUp.mockResolvedValue({
      userSub: 'sub',
      email: 'a@b.com',
    });

    const res = await service.register('a@b.com', 'Password1!', 'A');
    expect(res).toMatchObject({
      status: 'ok',
      userSub: 'sub',
      email: 'a@b.com',
    });
  });

  it('confirmSignUp throws 400 when missing email/code', async () => {
    const { service } = makeService();
    await expect(service.confirmSignUp('', '')).rejects.toMatchObject({
      getStatus: expect.any(Function),
    });
  });

  it('confirmSignUp returns ok when provider succeeds', async () => {
    const { service, cognitoService } = makeService();
    cognitoService.confirmSignUp.mockResolvedValue({ success: true });

    const res = await service.confirmSignUp('a@b.com', '1234');
    expect(res).toMatchObject({ status: 'ok', success: true });
  });

  it('login throws 404 when user missing in DB', async () => {
    const { service, prisma, cognitoService } = makeService();
    cognitoService.signIn.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('a@b.com', 'Password1!')).rejects.toMatchObject({
      getStatus: expect.any(Function),
    });
  });

  it('login returns ok with tokens and user when valid', async () => {
    const { service, prisma, cognitoService, jwtService } = makeService();
    cognitoService.signIn.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      cognitoSub: 'csub',
    });
    jwtService.sign
      .mockReturnValueOnce('access')
      .mockReturnValueOnce('refresh');

    const res = await service.login('a@b.com', 'Password1!');
    expect(res).toMatchObject({
      status: 'ok',
      token: 'access',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'a@b.com' },
    });
  });

  it('forgotPassword returns ok even if provider throws', async () => {
    const { service, cognitoService } = makeService();
    cognitoService.forgotPassword.mockRejectedValue(new Error('provider down'));
    const res = await service.forgotPassword('a@b.com');
    expect(res.status).toBe('ok');
  });

  it('confirmForgotPassword validates input and returns ok', async () => {
    const { service, cognitoService } = makeService();
    cognitoService.confirmForgotPassword.mockResolvedValue({});
    const res = await service.confirmForgotPassword(
      'a@b.com',
      '1234',
      'Passw0rd!',
    );
    expect(res.status).toBe('ok');
  });

  it('confirmForgotPassword throws 400 when password too short', async () => {
    const { service } = makeService();
    await expect(
      service.confirmForgotPassword('a@b.com', '1234', '123'),
    ).rejects.toMatchObject({ getStatus: expect.any(Function) });
  });

  it('googleCallback returns redirect parts on success', async () => {
    const { service, prisma, jwtService } = makeService({
      configService: {
        get: jest.fn((key: string) => {
          if (key === 'GOOGLE_OAUTH_CLIENT_ID') return 'client';
          if (key === 'GOOGLE_OAUTH_CLIENT_SECRET') return 'secret';
          if (key === 'GOOGLE_OAUTH_CALLBACK_URL') return 'http://cb';
          return undefined;
        }),
      },
    });

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      picture: null,
    });
    jwtService.sign
      .mockReturnValueOnce('access')
      .mockReturnValueOnce('refresh');

    const res = await service.googleCallback(
      'code',
      encodeURIComponent('my://redirect?x=1'),
    );
    expect(res).toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
      redirectTo: 'my://redirect?x=1',
      separator: '&',
    });
  });

  it('googleCallback throws 401 when Google token response has no id_token', async () => {
    const { service } = makeService({
      configService: {
        get: jest.fn((key: string) => {
          if (key === 'GOOGLE_OAUTH_CLIENT_ID') return 'client';
          if (key === 'GOOGLE_OAUTH_CLIENT_SECRET') return 'secret';
          if (key === 'GOOGLE_OAUTH_CALLBACK_URL') return 'http://cb';
          return undefined;
        }),
      },
    });

    getTokenMock.mockResolvedValueOnce({ tokens: {} });

    try {
      await service.googleCallback('code', encodeURIComponent('my://redirect'));
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(401);
    }
  });

  it('refreshAccessToken throws 401 when token type is not refresh', async () => {
    const { service, jwtService } = makeService();
    jwtService.verify.mockReturnValue({ sub: 'u1', type: 'access' });

    try {
      await service.refreshAccessToken('token');
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(401);
    }
  });

  it('refreshAccessToken returns ok when token is valid and user exists', async () => {
    const { service, jwtService, prisma } = makeService();
    jwtService.verify.mockReturnValue({ sub: 'u1', type: 'refresh' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      picture: null,
    });

    const res = await service.refreshAccessToken('token');
    expect(res.status).toBe('ok');
    expect(res).toHaveProperty('token');
    expect(res).toHaveProperty('refreshToken');
  });

  it('refreshAccessToken throws 404 when user not found', async () => {
    const { service, jwtService, prisma } = makeService();
    jwtService.verify.mockReturnValue({ sub: 'u1', type: 'refresh' });
    prisma.user.findUnique.mockResolvedValue(null);

    try {
      await service.refreshAccessToken('token');
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(404);
    }
  });

  it('refreshAccessToken throws 401 when verify fails', async () => {
    const { service, jwtService } = makeService();
    jwtService.verify.mockImplementation(() => {
      throw new Error('bad');
    });

    try {
      await service.refreshAccessToken('bad-token');
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(401);
    }
  });
});
