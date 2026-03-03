import { Controller, Get, Param, Request } from '@nestjs/common';
import { Level } from 'src/common/types';
import { LevelsService } from 'src/services';
import { Public } from './decorators/public.decorator';
import type { RequestAuth } from '../common/types';

@Controller('levels')
export class LevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  /**
   * Get levels for a given difficulty.
   * If authenticated, includes user's best scores and unlock status based on progression.
   * If not authenticated, all levels are shown as locked.
   */
  @Public()
  @Get(':difficulty')
  async getLevelsByDifficulty(
    @Param('difficulty') difficulty: string,
    @Request() req?: RequestAuth,
  ): Promise<{
    status: 'ok';
    levels: Level[];
  }> {
    const userId = req?.user?.sub;
    const { levels } = await this.levelsService.getLevelsByDifficulty(
      difficulty,
      userId,
    );
    return { status: 'ok', levels };
  }
}
