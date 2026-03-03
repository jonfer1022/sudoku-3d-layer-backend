/*
  Warnings:

  - You are about to alter the column `value` on the `sudoku_original` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(250)`.

*/
-- AlterTable
ALTER TABLE "sudoku_original" ALTER COLUMN "value" SET DATA TYPE VARCHAR(250);

-- CreateTable
CREATE TABLE "sudoku_incomplete" (
    "id" TEXT NOT NULL,
    "value" VARCHAR(250) NOT NULL,
    "sudokuId" VARCHAR(250) NOT NULL,

    CONSTRAINT "sudoku_incomplete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sudoku_incomplete_sudokuId_key" ON "sudoku_incomplete"("sudokuId");

-- AddForeignKey
ALTER TABLE "sudoku_incomplete" ADD CONSTRAINT "sudoku_incomplete_sudokuId_fkey" FOREIGN KEY ("sudokuId") REFERENCES "sudoku_original"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
