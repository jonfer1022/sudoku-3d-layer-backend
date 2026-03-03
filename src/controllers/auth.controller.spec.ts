import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('googleLogin redirects to auth url', () => {
    const authService = {
      googleLogin: jest.fn().mockReturnValue('http://google'),
    } as any;
    const controller = new AuthController(authService);

    const res = { redirect: jest.fn() } as any;
    controller.googleLogin('my://redirect', res);
    expect(authService.googleLogin).toHaveBeenCalledWith('my://redirect');
    expect(res.redirect).toHaveBeenCalledWith('http://google');
  });

  it('delegates exchangeGoogleToken/register/login/refresh to service', async () => {
    const authService = {
      exchangeGoogleToken: jest.fn().mockResolvedValue({ status: 'ok' }),
      register: jest.fn().mockResolvedValue({ status: 'ok' }),
      login: jest.fn().mockResolvedValue({ status: 'ok' }),
      refreshAccessToken: jest.fn().mockResolvedValue({ status: 'ok' }),
      confirmSignUp: jest.fn().mockResolvedValue({ status: 'ok' }),
      forgotPassword: jest.fn().mockResolvedValue({ status: 'ok' }),
      confirmForgotPassword: jest.fn().mockResolvedValue({ status: 'ok' }),
      googleCallback: jest.fn().mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        redirectTo: 'my://redirect',
        separator: '?',
      }),
    } as any;
    const controller = new AuthController(authService);

    await controller.exchangeGoogleToken('id');
    await controller.register({
      email: 'a@b.com',
      password: 'Password1!',
      name: 'A',
    } as any);
    await controller.login({ email: 'a@b.com', password: 'Password1!' } as any);
    await controller.refresh('rt');
    await controller.confirmSignUp('a@b.com', '1234');
    await controller.forgotPassword('a@b.com');
    await controller.resetPassword('a@b.com', '1234', 'Password1!');

    const res = { redirect: jest.fn() } as any;
    await controller.googleCallback(
      'code',
      encodeURIComponent('my://redirect'),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(
      'my://redirect?token=a&refreshToken=r',
    );
  });
});
