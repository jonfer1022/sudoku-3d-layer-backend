-- CreateTable
CREATE TABLE "game_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sudokuId" TEXT NOT NULL,
    "timeTakenSeconds" INTEGER NOT NULL,
    "mistakesMade" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_scores_userId_idx" ON "game_scores"("userId");

-- CreateIndex
CREATE INDEX "game_scores_sudokuId_idx" ON "game_scores"("sudokuId");

-- AddForeignKey
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_sudokuId_fkey" FOREIGN KEY ("sudokuId") REFERENCES "sudoku_incomplete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
