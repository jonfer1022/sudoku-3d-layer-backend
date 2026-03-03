import { Injectable } from '@nestjs/common';
import { Level } from 'src/common/types';
import { PrismaService } from 'src/repositories/prisma/prisma.service';

@Injectable()
export class LevelsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get levels for a difficulty with user scores and unlock status.
   *
   * Unlock rules:
   * 1. The first three levels are unlocked by default.
   * 2. To unlock level N (N > 3) the player must have **played every level
   *    preceding N at least once**. The actual score on those earlier levels does
   *    not matter for the "played at least once" requirement.
   * 3. In addition to playing all earlier levels, the immediately prior level
   *    (N - 1) must have been completed with **at least two stars** before level
   *    N becomes available. This enforces a minimum performance threshold before
   *    advancing past the free initial levels.
   *
   * Scores and stars are calculated from the user's best completed attempt for
   * each sudoku. Unauthenticated requests will return all levels locked.
   */
  async getLevelsByDifficulty(
    difficulty: string,
    userId?: string,
  ): Promise<{ levels: Level[] }> {
    const sudokus = await this.prisma.sudoku_incomplete.findMany({
      where: { difficulty },
      orderBy: { id: 'asc' },
    });

    // Get user's completed games (if authenticated)
    const completedGames = userId
      ? await this.prisma.gameScore.findMany({
          where: {
            userId,
            isCompleted: true,
          },
          select: {
            sudokuId: true,
            score: true,
          },
        })
      : [];

    const completedSudokuIds = new Set(completedGames.map((g) => g.sudokuId));

    // precompute best score and star count per sudoku
    const scoresMap = new Map<string, number>();
    const starsMap = new Map<string, number>();
    completedGames.forEach((g) => {
      const scoreVal = g.score || 0;
      scoresMap.set(g.sudokuId, scoreVal);

      let starCount = 0;
      if (scoreVal >= 800) starCount = 3;
      else if (scoreVal >= 600) starCount = 2;
      else if (scoreVal >= 400) starCount = 1;
      starsMap.set(g.sudokuId, starCount);
    });

    // Map to levels with progression
    const levels: Level[] = sudokus.map((sudoku, index) => {
      // Determine if previous level qualifies for unlocking
      let isUnlocked = false;
      if (index < 3) {
        // first three levels unlocked by default
        isUnlocked = true;
      } else {
        // require every earlier level to have been played at least once
        const allPrevPlayed = sudokus
          .slice(0, index)
          .every((s) => completedSudokuIds.has(s.id));

        if (allPrevPlayed) {
          // further require that the immediately preceding level earned
          // at least two stars before the next one becomes available
          const prevId = sudokus[index - 1].id;
          const prevStars = starsMap.get(prevId) || 0;
          isUnlocked = prevStars >= 2;
        } else {
          isUnlocked = false;
        }
      }

      // Get best score if user completed this level
      const bestScore = scoresMap.get(sudoku.id) || 0;

      // Calculate stars for current level (in case not computed above)
      const stars = starsMap.get(sudoku.id) || 0;

      return {
        id: sudoku.id,
        level: sudoku.level,
        stars,
        unlocked: isUnlocked,
        bestScore,
        isCompleted: completedSudokuIds.has(sudoku.id),
      };
    });

    return { levels };
  }
}
