/*
  Warnings:

  - You are about to drop the `Dream` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Dream" DROP CONSTRAINT "Dream_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Dream" DROP CONSTRAINT "Dream_waveId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "dream" TEXT,
ADD COLUMN     "username" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."Dream";

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");
