import { GameScoreService } from './game-score.service';

describe('GameScoreService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calculateScore applies caps and minimum', () => {
    const prisma = {} as any;
    const service = new GameScoreService(prisma);

    // Very large penalties but should not go below 50.
    expect(service.calculateScore(9999, 999, 999)).toBe(50);

    // No penalties.
    expect(service.calculateScore(0, 0, 0)).toBe(1000);

    // Caps: time max 500, mistakes max 200, hints max 250.
    // Score = 1000 - 500 - 200 - 250 = 50
    expect(service.calculateScore(600, 30, 20)).toBe(50);
  });

  it('submitScore throws 401 when user is missing', async () => {
    const prisma = {} as any;
    const service = new GameScoreService(prisma);

    try {
      await service.submitScore(undefined as any, 's1', 1, 0, 0);
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(401);
    }
  });

  it('submitScore throws 404 when sudoku does not exist', async () => {
    const prisma = {
      sudoku_incomplete: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any;
    const service = new GameScoreService(prisma);

    try {
      await service.submitScore({ sub: 'u1' } as any, 's1', 1, 0, 0);
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(404);
      expect(err.getResponse()).toMatchObject({
        status: 'error',
        code: 'SUDOKU_NOT_FOUND',
      });
    }
  });

  it('submitScore creates record and returns ok on success', async () => {
    const prisma = {
      sudoku_incomplete: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1' }),
      },
      gameScore: {
        create: jest.fn().mockResolvedValue({ id: 'gs1' }),
      },
    } as any;

    const service = new GameScoreService(prisma);
    const res = await service.submitScore({ sub: 'u1' } as any, 's1', 10, 1, 1);
    expect(res.status).toBe('ok');
    expect(prisma.gameScore.create).toHaveBeenCalled();
  });

  it('getUserGameHistory returns stats and supports difficulty filter', async () => {
    const prisma = {
      gameScore: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ score: 100, timeTakenSeconds: 10 }]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;
    const service = new GameScoreService(prisma);

    const res = await service.getUserGameHistory({ sub: 'u1' } as any, {
      difficulty: 'easy',
      limit: 1,
      offset: 0,
    });

    expect(res).toMatchObject({
      status: 'ok',
      statistics: {
        totalGames: 1,
        averageScore: 100,
        totalTimeSpentSeconds: 10,
      },
    });

    const whereArg = prisma.gameScore.findMany.mock.calls[0][0].where;
    expect(whereArg).toMatchObject({
      userId: 'u1',
      sudoku: { difficulty: 'easy' },
    });
  });

  it('getBestScores returns ok list', async () => {
    const prisma = {
      gameScore: {
        findMany: jest.fn().mockResolvedValue([{ id: 'x' }]),
      },
    } as any;
    const service = new GameScoreService(prisma);

    await expect(
      service.getBestScores({ sub: 'u1' } as any, 5),
    ).resolves.toEqual({
      status: 'ok',
      bestScores: [{ id: 'x' }],
    });
  });

  it('getLeaderboard returns ok list', async () => {
    const prisma = {
      gameScore: {
        findMany: jest.fn().mockResolvedValue([{ id: 'x' }]),
      },
    } as any;
    const service = new GameScoreService(prisma);

    await expect(service.getLeaderboard('easy', 3)).resolves.toEqual({
      status: 'ok',
      leaderboard: [{ id: 'x' }],
    });
  });

  it('getSudokuStats returns ok aggregate stats', async () => {
    const prisma = {
      gameScore: {
        aggregate: jest.fn().mockResolvedValue({
          _count: 2,
          _avg: {
            timeTakenSeconds: 12.4,
            mistakesMade: 1.1,
            hintsUsed: 0.2,
            score: 500.7,
          },
          _min: { score: 200 },
          _max: { score: 800 },
        }),
      },
    } as any;
    const service = new GameScoreService(prisma);

    const res = await service.getSudokuStats('s1');
    expect(res.status).toBe('ok');
    expect(res.statistics).toMatchObject({
      totalAttempts: 2,
      averageTime: 12,
      bestScore: 800,
      worstScore: 200,
    });
  });
});
