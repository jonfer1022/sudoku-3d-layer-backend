/*
  Warnings:

  - Added the required column `difficulty` to the `sudoku_incomplete` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sudoku_incomplete" ADD COLUMN     "difficulty" TEXT NOT NULL;
