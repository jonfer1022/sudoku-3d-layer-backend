import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  Query,
  Param,
} from '@nestjs/common';
import { GameScoreService } from 'src/services';
import type { RequestAuth } from '../common/types';
import { Public } from './decorators/public.decorator';

@Controller('game-scores')
export class GameScoreController {
  constructor(private readonly gameScoreService: GameScoreService) {}

  /**
   * Submit a completed game score.
   */
  @Post('submit')
  async submitScore(
    @Request() req: RequestAuth,
    @Body('sudokuId') sudokuId: string,
    @Body('timeTakenSeconds') timeTakenSeconds: number,
    @Body('mistakesMade') mistakesMade: number,
    @Body('hintsUsed') hintsUsed: number = 0,
  ) {
    return await this.gameScoreService.submitScore(
      req?.user,
      sudokuId,
      timeTakenSeconds,
      mistakesMade,
      hintsUsed,
    );
  }

  /**
   * Get user's game history with pagination and filters.
   */
  @Get('history')
  async getGameHistory(
    @Request() req: RequestAuth,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    return await this.gameScoreService.getUserGameHistory(req?.user, {
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      difficulty,
    });
  }

  /**
   * Get user's best scores.
   */
  @Get('best')
  async getBestScores(
    @Request() req: RequestAuth,
    @Query('limit') limit?: string,
  ) {
    return await this.gameScoreService.getBestScores(
      req?.user,
      limit ? parseInt(limit) : 10,
    );
  }

  /**
   * Get global leaderboard (public endpoint).
   */
  @Public()
  @Get('leaderboard')
  async getLeaderboard(
    @Query('difficulty') difficulty?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.gameScoreService.getLeaderboard(
      difficulty,
      limit ? parseInt(limit) : 10,
    );
  }

  /**
   * Get statistics for a specific sudoku (public endpoint).
   */
  @Public()
  @Get('sudoku-stats/:sudokuId')
  async getSudokuStats(@Param('sudokuId') sudokuId: string) {
    return await this.gameScoreService.getSudokuStats(sudokuId);
  }
}
