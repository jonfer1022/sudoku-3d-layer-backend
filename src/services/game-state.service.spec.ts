import { GameStateService } from './game-state.service';

describe('GameStateService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saveGameState returns status ok with saved state', async () => {
    const prisma = {
      gameState: {
        upsert: jest.fn().mockResolvedValue({ id: 'gs1' }),
      },
    } as any;

    const service = new GameStateService(prisma);

    const res = await service.saveGameState('u1', {
      sudokuId: 's1',
      gridState: '{}',
      timeTakenSeconds: 1,
      mistakesMade: 0,
      hintsUsed: 0,
      currentLayer: 1,
      isCompleted: false,
    });

    expect(res).toEqual({ status: 'ok', gameState: { id: 'gs1' } });
  });

  it('getGameState returns ok null when missing', async () => {
    const prisma = {
      gameState: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const service = new GameStateService(prisma);
    await expect(service.getGameState('u1')).resolves.toEqual({
      status: 'ok',
      gameState: null,
    });
  });

  it('getGameState returns ok with record when found', async () => {
    const prisma = {
      gameState: {
        findUnique: jest.fn().mockResolvedValue({ id: 'gs1' }),
      },
    } as any;

    const service = new GameStateService(prisma);
    await expect(service.getGameState('u1')).resolves.toEqual({
      status: 'ok',
      gameState: { id: 'gs1' },
    });
  });

  it('deleteGameState returns ok when deleted', async () => {
    const prisma = {
      gameState: {
        delete: jest.fn().mockResolvedValue({ id: 'gs1' }),
      },
    } as any;

    const service = new GameStateService(prisma);
    await expect(service.deleteGameState('u1')).resolves.toEqual({
      status: 'ok',
    });
  });

  it('deleteGameState throws 404 when prisma indicates missing record', async () => {
    const prisma = {
      gameState: {
        delete: jest.fn().mockRejectedValue({ code: 'P2025' }),
      },
    } as any;

    const service = new GameStateService(prisma);

    try {
      await service.deleteGameState('u1');
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(404);
      expect(err.getResponse()).toMatchObject({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Game state not found',
      });
    }
  });

  it('hasActiveGame returns boolean based on prisma result', async () => {
    const prisma = {
      gameState: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'gs1' })
          .mockResolvedValueOnce(null),
      },
    } as any;

    const service = new GameStateService(prisma);
    await expect(service.hasActiveGame('u1')).resolves.toBe(true);
    await expect(service.hasActiveGame('u1')).resolves.toBe(false);
  });
});
