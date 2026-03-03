import { LevelsService } from './levels.service';

describe('LevelsService', () => {
  it('returns first three levels unlocked even without userId (current behavior)', async () => {
    const sudokus = [
      { id: 's1', level: 1 },
      { id: 's2', level: 2 },
      { id: 's3', level: 3 },
      { id: 's4', level: 4 },
    ];

    const prisma = {
      sudoku_incomplete: {
        findMany: jest.fn().mockResolvedValue(sudokus),
      },
      gameScore: {
        findMany: jest.fn(),
      },
    } as any;

    const service = new LevelsService(prisma);
    const res = await service.getLevelsByDifficulty('easy');

    expect(res.levels[0].unlocked).toBe(true);
    expect(res.levels[1].unlocked).toBe(true);
    expect(res.levels[2].unlocked).toBe(true);
    expect(res.levels[3].unlocked).toBe(false);
  });

  it('computes unlocks and stars from completed games', async () => {
    const sudokus = [
      { id: 's1', level: 1 },
      { id: 's2', level: 2 },
      { id: 's3', level: 3 },
      { id: 's4', level: 4 },
    ];

    const prisma = {
      sudoku_incomplete: {
        findMany: jest.fn().mockResolvedValue(sudokus),
      },
      gameScore: {
        findMany: jest.fn().mockResolvedValue([
          { sudokuId: 's1', score: 450 }, // 1 star
          { sudokuId: 's2', score: 650 }, // 2 stars
          { sudokuId: 's3', score: 700 }, // 2 stars -> unlocks s4 if all prev played
        ]),
      },
    } as any;

    const service = new LevelsService(prisma);

    const res = await service.getLevelsByDifficulty('easy', 'user-1');
    expect(res.levels).toHaveLength(4);

    expect(res.levels[0]).toMatchObject({ id: 's1', stars: 1, unlocked: true });
    expect(res.levels[1]).toMatchObject({ id: 's2', stars: 2, unlocked: true });
    expect(res.levels[2]).toMatchObject({ id: 's3', stars: 2, unlocked: true });
    expect(res.levels[3]).toMatchObject({ id: 's4', stars: 0, unlocked: true });
  });

  it('keeps later levels locked until all previous are played and prev has >=2 stars', async () => {
    const sudokus = [
      { id: 's1', level: 1 },
      { id: 's2', level: 2 },
      { id: 's3', level: 3 },
      { id: 's4', level: 4 },
    ];

    const prisma = {
      sudoku_incomplete: {
        findMany: jest.fn().mockResolvedValue(sudokus),
      },
      gameScore: {
        findMany: jest.fn().mockResolvedValue([
          { sudokuId: 's1', score: 900 },
          { sudokuId: 's2', score: 900 },
          { sudokuId: 's3', score: 500 }, // 1 star on prev level, so s4 should stay locked
        ]),
      },
    } as any;

    const service = new LevelsService(prisma);
    const res = await service.getLevelsByDifficulty('easy', 'u1');
    expect(res.levels[3]).toMatchObject({ id: 's4', unlocked: false });
  });
});
