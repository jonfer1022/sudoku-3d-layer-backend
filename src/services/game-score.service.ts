import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from 'src/repositories/prisma/prisma.service';
import { UserAuth } from 'src/common/types';
import { AppErrorCode } from 'src/common/errors/app-error-code';
import {
  appInternal,
  appNotFound,
  appUnauthorized,
} from 'src/common/errors/app-http-exception';

@Injectable()
export class GameScoreService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate score based on time, mistakes, and hints used.
   * Base formula: 1000 - (timePenalty + mistakePenalty + hintPenalty)
   *
   * - timePenalty: 1 point per second (max 500)
   * - mistakePenalty: 10 points per mistake (max 200)
   * - hintPenalty: 25 points per hint (max 250)
   *
   * Minimum score is 50 points for completion.
   */
  calculateScore(
    timeTakenSeconds: number,
    mistakesMade: number,
    hintsUsed: number,
  ): number {
    const timePenalty = Math.min(timeTakenSeconds, 500); // Max 500 points for time
    const mistakePenalty = Math.min(mistakesMade * 10, 200); // Max 200 points for mistakes
    const hintPenalty = Math.min(hintsUsed * 25, 250); // Max 250 points for hints

    const score = 1000 - timePenalty - mistakePenalty - hintPenalty;
    return Math.max(score, 50); // Minimum 50 points for completing
  }

  /**
   * Submit a game score after completing a sudoku.
   */
  async submitScore(
    user: UserAuth,
    sudokuId: string,
    timeTakenSeconds: number,
    mistakesMade: number,
    hintsUsed: number,
  ) {
    try {
      if (!user?.sub) {
        throw appUnauthorized(
          AppErrorCode.Unauthorized,
          'User not authenticated',
        );
      }

      // Verify sudoku exists
      const sudoku = await this.prisma.sudoku_incomplete.findUnique({
        where: { id: sudokuId },
      });

      if (!sudoku) {
        throw appNotFound(AppErrorCode.SudokuNotFound, 'Sudoku not found');
      }

      // Calculate score
      const score = this.calculateScore(
        timeTakenSeconds,
        mistakesMade,
        hintsUsed,
      );

      // Create game score record
      const gameScore = await this.prisma.gameScore.create({
        data: {
          userId: user.sub,
          sudokuId,
          timeTakenSeconds,
          mistakesMade,
          hintsUsed,
          isCompleted: true,
          score,
          completedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sudoku: {
            select: {
              id: true,
              difficulty: true,
            },
          },
        },
      });

      return {
        status: 'ok',
        message: 'Game score submitted',
        gameScore,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Submit score error', err);
      throw appInternal(AppErrorCode.Internal, 'Failed to submit score');
    }
  }

  /**
   * Get user's game history with optional filters.
   */
  async getUserGameHistory(
    user: UserAuth,
    options?: {
      limit?: number;
      offset?: number;
      difficulty?: string;
    },
  ) {
    try {
      if (!user?.sub) {
        throw appUnauthorized(
          AppErrorCode.Unauthorized,
          'User not authenticated',
        );
      }

      const where: { userId: string; sudoku?: any } = { userId: user.sub };
      if (options?.difficulty) {
        where.sudoku = { difficulty: options.difficulty };
      }

      const gameScores = await this.prisma.gameScore.findMany({
        where,
        include: {
          sudoku: {
            select: {
              id: true,
              difficulty: true,
              level: true,
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      });

      // Calculate statistics
      const totalGames = await this.prisma.gameScore.count({
        where: { userId: user.sub },
      });

      const avgScore =
        gameScores.length > 0
          ? gameScores.reduce((sum, g) => sum + (g.score || 0), 0) /
            gameScores.length
          : 0;

      const totalTimeSpent = gameScores.reduce(
        (sum, g) => sum + g.timeTakenSeconds,
        0,
      );

      return {
        status: 'ok',
        gameScores,
        statistics: {
          totalGames,
          averageScore: Math.round(avgScore),
          totalTimeSpentSeconds: totalTimeSpent,
          totalTimeSpentMinutes: Math.round(totalTimeSpent / 60),
        },
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Get game history error', err);
      throw appInternal(AppErrorCode.Internal, 'Failed to fetch game history');
    }
  }

  /**
   * Get user's best scores.
   */
  async getBestScores(user: UserAuth, limit: number = 10) {
    try {
      if (!user?.sub) {
        throw appUnauthorized(
          AppErrorCode.Unauthorized,
          'User not authenticated',
        );
      }

      const bestScores = await this.prisma.gameScore.findMany({
        where: { userId: user.sub },
        include: {
          sudoku: {
            select: {
              id: true,
              difficulty: true,
            },
          },
        },
        orderBy: { score: 'desc' },
        take: limit,
      });

      return {
        status: 'ok',
        bestScores,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Get best scores error', err);
      throw appInternal(AppErrorCode.Internal, 'Failed to fetch best scores');
    }
  }

  /**
   * Get leaderboard for a specific difficulty.
   */
  async getLeaderboard(difficulty?: string, limit: number = 10) {
    try {
      const where: { sudoku?: any } = {};
      if (difficulty) {
        where.sudoku = { difficulty };
      }

      const leaderboard = await this.prisma.gameScore.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          sudoku: {
            select: {
              difficulty: true,
            },
          },
        },
        orderBy: { score: 'desc' },
        take: limit,
      });

      return {
        status: 'ok',
        leaderboard,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Get leaderboard error', err);
      throw appInternal(AppErrorCode.Internal, 'Failed to fetch leaderboard');
    }
  }

  /**
   * Get statistics for a specific sudoku.
   */
  async getSudokuStats(sudokuId: string) {
    try {
      const stats = await this.prisma.gameScore.aggregate({
        where: { sudokuId },
        _avg: {
          timeTakenSeconds: true,
          mistakesMade: true,
          hintsUsed: true,
          score: true,
        },
        _min: {
          score: true,
        },
        _max: {
          score: true,
        },
        _count: true,
      });

      return {
        status: 'ok',
        statistics: {
          totalAttempts: stats._count,
          averageTime: Math.round(stats._avg.timeTakenSeconds || 0),
          averageMistakes: Math.round(stats._avg.mistakesMade || 0),
          averageHintsUsed: Math.round(stats._avg.hintsUsed || 0),
          averageScore: Math.round(stats._avg.score || 0),
          bestScore: stats._max.score,
          worstScore: stats._min.score,
        },
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Get sudoku stats error', err);
      throw appInternal(
        AppErrorCode.Internal,
        'Failed to fetch sudoku statistics',
      );
    }
  }
}
