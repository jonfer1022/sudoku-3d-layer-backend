import { SudokuService } from './sudoku.service';

describe('SudokuService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws 404 when sudoku is not found', async () => {
    const prisma = {
      sudoku_incomplete: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const service = new SudokuService(prisma);

    try {
      await service.getSpecificSudoku('missing');
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(404);
      expect(err.getResponse()).toMatchObject({
        status: 'error',
        code: 'SUDOKU_NOT_FOUND',
        message: 'Sudoku not found',
      });
    }
  });

  it('returns parsed sudoku grid when found', async () => {
    const grid = [[[[{ digit: 1, fixed: true }]]]];
    const prisma = {
      sudoku_incomplete: {
        findFirst: jest.fn().mockResolvedValue({ value: JSON.stringify(grid) }),
      },
    } as any;

    const service = new SudokuService(prisma);

    await expect(service.getSpecificSudoku('id')).resolves.toEqual(grid);
  });

  it('throws 500 when stored JSON is invalid', async () => {
    const prisma = {
      sudoku_incomplete: {
        findFirst: jest.fn().mockResolvedValue({ value: 'not-json' }),
      },
    } as any;

    const service = new SudokuService(prisma);

    try {
      await service.getSpecificSudoku('id');
      throw new Error('Expected service to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(500);
    }
  });
});
