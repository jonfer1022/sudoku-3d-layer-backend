import { SudokuController } from './sudoku.controller';

describe('SudokuController', () => {
  it('wraps service result in {status: ok, sudoku}', async () => {
    const sudokuService = {
      getSpecificSudoku: jest.fn().mockResolvedValue('GRID'),
    } as any;

    const controller = new SudokuController(sudokuService);
    await expect(controller.getSpecifycSudoku('s1')).resolves.toEqual({
      status: 'ok',
      sudoku: 'GRID',
    });
  });
});
