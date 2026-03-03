import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from 'src/repositories/prisma/prisma.service';
import { AppErrorCode } from 'src/common/errors/app-error-code';
import { appInternal, appNotFound } from 'src/common/errors/app-http-exception';

function getErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if (!('code' in err)) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export interface GameStateData {
  sudokuId: string;
  gridState: string;
  timeTakenSeconds: number;
  mistakesMade: number;
  hintsUsed: number;
  currentLayer: number;
  isCompleted: boolean;
}

@Injectable()
export class GameStateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Save or update the current game state for a user
   */
  async saveGameState(userId: string, gameState: GameStateData) {
    try {
      // Upsert: create if doesn't exist, update if exists
      const savedState = await this.prisma.gameState.upsert({
        where: { userId },
        update: {
          sudokuId: gameState.sudokuId,
          gridState: gameState.gridState,
          timeTakenSeconds: gameState.timeTakenSeconds,
          mistakesMade: gameState.mistakesMade,
          hintsUsed: gameState.hintsUsed,
          currentLayer: gameState.currentLayer,
          isCompleted: gameState.isCompleted,
          updatedAt: new Date(),
        },
        create: {
          userId,
          sudokuId: gameState.sudokuId,
          gridState: gameState.gridState,
          timeTakenSeconds: gameState.timeTakenSeconds,
          mistakesMade: gameState.mistakesMade,
          hintsUsed: gameState.hintsUsed,
          currentLayer: gameState.currentLayer,
          isCompleted: gameState.isCompleted,
        },
      });

      return { status: 'ok', gameState: savedState };
    } catch (error: unknown) {
      console.error('Error saving game state:', error);
      if (error instanceof HttpException) throw error;
      throw appInternal(AppErrorCode.Internal, 'Failed to save game state');
    }
  }

  /**
   * Get the current game state for a user
   */
  async getGameState(userId: string) {
    try {
      const gameState = await this.prisma.gameState.findUnique({
        where: { userId },
        include: {
          sudoku: {
            include: {
              sudoku: true, // Include the original sudoku
            },
          },
        },
      });

      if (!gameState) {
        return { status: 'ok', gameState: null };
      }

      return { status: 'ok', gameState };
    } catch (error: unknown) {
      console.error('Error getting game state:', error);
      if (error instanceof HttpException) throw error;
      throw appInternal(AppErrorCode.Internal, 'Failed to get game state');
    }
  }

  /**
   * Delete the game state for a user (when game is completed or abandoned)
   */
  async deleteGameState(userId: string) {
    try {
      await this.prisma.gameState.delete({
        where: { userId },
      });

      return { status: 'ok' };
    } catch (error: unknown) {
      console.error('Error deleting game state:', error);

      if (error instanceof HttpException) throw error;

      // If the record doesn't exist, treat as not found.
      const prismaCode = getErrorCode(error);
      if (prismaCode === 'P2025') {
        throw appNotFound(AppErrorCode.NotFound, 'Game state not found');
      }

      throw appInternal(AppErrorCode.Internal, 'Failed to delete game state');
    }
  }

  /**
   * Check if a user has an active game
   */
  async hasActiveGame(userId: string): Promise<boolean> {
    try {
      const gameState = await this.prisma.gameState.findUnique({
        where: { userId },
        select: { id: true },
      });

      return !!gameState;
    } catch (error: unknown) {
      console.error('Error checking active game:', error);

      if (error instanceof HttpException) throw error;
      throw appInternal(AppErrorCode.Internal, 'Failed to check active game');
    }
  }
}
