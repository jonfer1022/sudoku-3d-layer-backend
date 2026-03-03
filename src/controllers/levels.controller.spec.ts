import { LevelsController } from './levels.controller';

describe('LevelsController', () => {
  it('returns {status: ok, levels}', async () => {
    const levelsService = {
      getLevelsByDifficulty: jest
        .fn()
        .mockResolvedValue({ levels: [{ id: 's1' }] }),
    } as any;

    const controller = new LevelsController(levelsService);
    const res = await controller.getLevelsByDifficulty('easy', {
      user: { sub: 'u1' },
    } as any);

    expect(res).toEqual({ status: 'ok', levels: [{ id: 's1' }] });
    expect(levelsService.getLevelsByDifficulty).toHaveBeenCalledWith(
      'easy',
      'u1',
    );
  });
});
