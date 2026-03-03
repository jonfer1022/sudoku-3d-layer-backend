import { Controller, Get, Param } from '@nestjs/common';
import { Cell } from 'src/common/constants';
import { SudokuService } from 'src/services';

@Controller('sudoku')
export class SudokuController {
  constructor(private readonly sudokuService: SudokuService) {}

  @Get(':id')
  async getSpecifycSudoku(
    @Param('id') id: string,
  ): Promise<{ status: 'ok'; sudoku: Cell[][][][] }> {
    const sudoku = await this.sudokuService.getSpecificSudoku(id);
    return { status: 'ok', sudoku };
  }
}
