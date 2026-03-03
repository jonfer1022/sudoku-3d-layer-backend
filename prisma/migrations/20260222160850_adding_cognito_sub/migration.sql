/*
  Warnings:

  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordResetExpiresAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordResetToken` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `refresh_sessions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cognitoSub]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "refresh_sessions" DROP CONSTRAINT "refresh_sessions_userId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password",
DROP COLUMN "passwordResetExpiresAt",
DROP COLUMN "passwordResetToken",
DROP COLUMN "refreshToken",
ADD COLUMN     "cognitoSub" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "refresh_sessions";

-- CreateIndex
CREATE UNIQUE INDEX "users_cognitoSub_key" ON "users"("cognitoSub");
