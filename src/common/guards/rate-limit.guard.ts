import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user as { sub?: string } | undefined;
    return Promise.resolve(user?.sub ?? (req.ip as string) ?? 'unknown');
  }
}
