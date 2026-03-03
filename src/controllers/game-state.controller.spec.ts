import { UnauthorizedException } from '@nestjs/common';
import { GameStateController } from './game-state.controller';

describe('GameStateController', () => {
  it('throws UnauthorizedException when no user in request', async () => {
    const service = {} as any;
    const controller = new GameStateController(service);

    await expect(controller.getGameState({} as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns {status: ok, hasActiveGame} from service result', async () => {
    const service = {
      hasActiveGame: jest.fn().mockResolvedValue(true),
    } as any;
    const controller = new GameStateController(service);

    await expect(
      controller.hasActiveGame({ user: { sub: 'u1' } } as any),
    ).resolves.toEqual({ status: 'ok', hasActiveGame: true });
  });

  it('calls service methods with authenticated user id', async () => {
    const service = {
      getGameState: jest
        .fn()
        .mockResolvedValue({ status: 'ok', gameState: null }),
      saveGameState: jest
        .fn()
        .mockResolvedValue({ status: 'ok', gameState: { id: 'gs1' } }),
      deleteGameState: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as any;
    const controller = new GameStateController(service);

    await controller.getGameState({ user: { sub: 'u1' } } as any);
    await controller.saveGameState({ user: { sub: 'u1' } } as any, {
      sudokuId: 's1',
      gridState: '{}',
      timeTakenSeconds: 0,
      mistakesMade: 0,
      hintsUsed: 0,
      currentLayer: 1,
      isCompleted: false,
    });
    await controller.deleteGameState({ user: { sub: 'u1' } } as any);

    expect(service.getGameState).toHaveBeenCalledWith('u1');
    expect(service.saveGameState).toHaveBeenCalled();
    expect(service.deleteGameState).toHaveBeenCalledWith('u1');
  });
});
