import { Injectable, HttpException } from '@nestjs/common';
import { Cell } from 'src/common/constants';
import { PrismaService } from 'src/repositories/prisma/prisma.service';
import { AppErrorCode } from 'src/common/errors/app-error-code';
import { appInternal, appNotFound } from 'src/common/errors/app-http-exception';

@Injectable()
export class SudokuService {
  constructor(private prisma: PrismaService) {}

  async getSpecificSudoku(id: string): Promise<Cell[][][][]> {
    try {
      const res = await this.prisma.sudoku_incomplete.findFirst({
        where: { id },
      });

      if (!res) {
        throw appNotFound(AppErrorCode.SudokuNotFound, 'Sudoku not found');
      }

      return JSON.parse(String(res.value)) as Cell[][][][];
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Get sudoku error', err);
      throw appInternal(AppErrorCode.Internal, 'Failed to load sudoku');
    }
  }
}
