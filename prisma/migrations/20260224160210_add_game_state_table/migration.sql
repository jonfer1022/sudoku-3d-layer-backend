-- CreateTable
CREATE TABLE "game_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sudokuId" TEXT NOT NULL,
    "gridState" TEXT NOT NULL,
    "timeTakenSeconds" INTEGER NOT NULL DEFAULT 0,
    "mistakesMade" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "currentLayer" INTEGER NOT NULL DEFAULT 1,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_states_userId_key" ON "game_states"("userId");

-- CreateIndex
CREATE INDEX "game_states_userId_idx" ON "game_states"("userId");

-- CreateIndex
CREATE INDEX "game_states_sudokuId_idx" ON "game_states"("sudokuId");

-- AddForeignKey
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_sudokuId_fkey" FOREIGN KEY ("sudokuId") REFERENCES "sudoku_incomplete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
