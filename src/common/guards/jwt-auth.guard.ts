import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../controllers/decorators/public.decorator';

interface JwtPayload {
  sub?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

interface CustomRequest extends Request {
  user?: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<CustomRequest>();
    const token = this.extractTokenFromHeader(request);

    if (isPublic) {
      // For public routes, optionally set user if token is present and valid
      if (token) {
        try {
          const payload = this.jwtService.verify<JwtPayload>(token);
          request.user = payload;
        } catch (err: unknown) {
          // For expired tokens, return 401 to trigger axios refresh logic
          if (err instanceof Error && err.name === 'TokenExpiredError') {
            if (err.name === 'TokenExpiredError') {
              throw new UnauthorizedException('Token expired');
            }
          }
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request.user = payload;
    } catch (err) {
      console.log('-----> ~ JwtAuthGuard ~ canActivate ~ err:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
