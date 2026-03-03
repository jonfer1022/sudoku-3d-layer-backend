import { GameScoreController } from './game-score.controller';

describe('GameScoreController', () => {
  it('calls submitScore with request user and body fields', async () => {
    const gameScoreService = {
      submitScore: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as any;
    const controller = new GameScoreController(gameScoreService);

    await controller.submitScore(
      { user: { sub: 'u1' } } as any,
      's1',
      10,
      1,
      0,
    );

    expect(gameScoreService.submitScore).toHaveBeenCalledWith(
      { sub: 'u1' },
      's1',
      10,
      1,
      0,
    );
  });

  it('parses query params with defaults in getGameHistory', async () => {
    const gameScoreService = {
      getUserGameHistory: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as any;
    const controller = new GameScoreController(gameScoreService);

    await controller.getGameHistory(
      { user: { sub: 'u1' } } as any,
      undefined,
      undefined,
      'easy',
    );
    expect(gameScoreService.getUserGameHistory).toHaveBeenCalledWith(
      { sub: 'u1' },
      { limit: 20, offset: 0, difficulty: 'easy' },
    );
  });

  it('passes sudokuId param into getSudokuStats', async () => {
    const gameScoreService = {
      getSudokuStats: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as any;

    const controller = new GameScoreController(gameScoreService);
    await controller.getSudokuStats('s1');

    expect(gameScoreService.getSudokuStats).toHaveBeenCalledWith('s1');
  });

  it('parses limit in getBestScores and forwards to service', async () => {
    const gameScoreService = {
      getBestScores: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as any;
    const controller = new GameScoreController(gameScoreService);

    await controller.getBestScores({ user: { sub: 'u1' } } as any, '5');
    expect(gameScoreService.getBestScores).toHaveBeenCalledWith(
      { sub: 'u1' },
      5,
    );
  });

  it('parses limit/difficulty in getLeaderboard and forwards to service', async () => {
    const gameScoreService = {
      getLeaderboard: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as any;
    const controller = new GameScoreController(gameScoreService);

    await controller.getLeaderboard('easy', '7');
    expect(gameScoreService.getLeaderboard).toHaveBeenCalledWith('easy', 7);
  });
});
