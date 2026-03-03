/*
  Warnings:

  - You are about to drop the column `name` on the `sudoku_original` table. All the data in the column will be lost.
  - Added the required column `value` to the `sudoku_original` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sudoku_original" DROP COLUMN "name",
ADD COLUMN     "value" TEXT NOT NULL;
