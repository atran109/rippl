/*
  Warnings:

  - You are about to alter the column `noteText` on the `ActionLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - The `allowedBuckets` column on the `Wave` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Dream` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."TrendingCalculationType" AS ENUM ('realtime', 'hourly', 'daily');

-- CreateEnum
CREATE TYPE "public"."ImpactCalculationType" AS ENUM ('realtime', 'daily', 'monthly', 'custom');

-- DropForeignKey
ALTER TABLE "public"."ActionLog" DROP CONSTRAINT "ActionLog_microActionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ActionLog" DROP CONSTRAINT "ActionLog_rippleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ActionLog" DROP CONSTRAINT "ActionLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ActionLog" DROP CONSTRAINT "ActionLog_waveId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Dream" DROP CONSTRAINT "Dream_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Dream" DROP CONSTRAINT "Dream_waveId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MicroAction" DROP CONSTRAINT "MicroAction_rippleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MicroAction" DROP CONSTRAINT "MicroAction_waveId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Ripple" DROP CONSTRAINT "Ripple_waveId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RippleActivity" DROP CONSTRAINT "RippleActivity_rippleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RippleSummary" DROP CONSTRAINT "RippleSummary_rippleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Template" DROP CONSTRAINT "Template_waveId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserRipple" DROP CONSTRAINT "UserRipple_rippleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserRipple" DROP CONSTRAINT "UserRipple_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WaveBucket" DROP CONSTRAINT "WaveBucket_waveId_fkey";

-- AlterTable
ALTER TABLE "public"."ActionLog" ALTER COLUMN "noteText" SET DATA TYPE VARCHAR(120);

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "dream" TEXT;

-- AlterTable
ALTER TABLE "public"."Wave" ADD COLUMN     "impactFormula" TEXT,
ADD COLUMN     "impactSourcesAndCaveats" TEXT,
ADD COLUMN     "impactWhatWeCount" TEXT,
DROP COLUMN "allowedBuckets",
ADD COLUMN     "allowedBuckets" JSONB NOT NULL DEFAULT '[]';

-- DropTable
DROP TABLE "public"."Dream";

-- CreateTable
CREATE TABLE "public"."BucketWeight" (
    "id" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BucketWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImpactCalculation" (
    "id" TEXT NOT NULL,
    "rippleId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "calculationType" "public"."ImpactCalculationType" NOT NULL DEFAULT 'realtime',
    "timeframe" TEXT,
    "totalActions" INTEGER NOT NULL,
    "eligibleActions" DOUBLE PRECISION NOT NULL,
    "impactValue" DOUBLE PRECISION NOT NULL,
    "bucketBreakdown" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImpactIndex" (
    "id" TEXT NOT NULL,
    "rippleId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "indexValue" DOUBLE PRECISION NOT NULL,
    "isVisible" BOOLEAN NOT NULL,
    "medianImpact30d" DOUBLE PRECISION NOT NULL,
    "rippleImpact30d" DOUBLE PRECISION NOT NULL,
    "participants" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserImpactSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalActions" INTEGER NOT NULL,
    "totalEligibleActions" DOUBLE PRECISION NOT NULL,
    "totalImpact" DOUBLE PRECISION NOT NULL,
    "ripplesJoined" INTEGER NOT NULL,
    "impactByWave" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserImpactSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RippleCounter" (
    "id" TEXT NOT NULL,
    "rippleId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "participantsTotal" INTEGER NOT NULL DEFAULT 0,
    "actions24h" INTEGER NOT NULL DEFAULT 0,
    "actions1h" INTEGER NOT NULL DEFAULT 0,
    "newParticipants24h" INTEGER NOT NULL DEFAULT 0,
    "boost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topTenSince" TIMESTAMP(3),
    "lastDecay" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RippleCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrendingScore" (
    "id" TEXT NOT NULL,
    "rippleId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "calculationType" "public"."TrendingCalculationType" NOT NULL DEFAULT 'realtime',
    "score" DOUBLE PRECISION NOT NULL,
    "participants" INTEGER NOT NULL,
    "actions24h" INTEGER NOT NULL,
    "actions1h" INTEGER NOT NULL,
    "newParticipants24h" INTEGER NOT NULL,
    "boost" DOUBLE PRECISION NOT NULL,
    "isTopTen" BOOLEAN NOT NULL DEFAULT false,
    "topTenDays" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BucketWeight_waveId_isActive_idx" ON "public"."BucketWeight"("waveId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BucketWeight_waveId_bucket_key" ON "public"."BucketWeight"("waveId", "bucket");

-- CreateIndex
CREATE INDEX "ImpactCalculation_rippleId_calculationType_timeframe_idx" ON "public"."ImpactCalculation"("rippleId", "calculationType", "timeframe");

-- CreateIndex
CREATE INDEX "ImpactCalculation_waveId_calculatedAt_idx" ON "public"."ImpactCalculation"("waveId", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactIndex_rippleId_key" ON "public"."ImpactIndex"("rippleId");

-- CreateIndex
CREATE INDEX "ImpactIndex_waveId_indexValue_idx" ON "public"."ImpactIndex"("waveId", "indexValue");

-- CreateIndex
CREATE INDEX "ImpactIndex_calculatedAt_idx" ON "public"."ImpactIndex"("calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserImpactSummary_userId_key" ON "public"."UserImpactSummary"("userId");

-- CreateIndex
CREATE INDEX "UserImpactSummary_calculatedAt_idx" ON "public"."UserImpactSummary"("calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RippleCounter_rippleId_key" ON "public"."RippleCounter"("rippleId");

-- CreateIndex
CREATE INDEX "RippleCounter_waveId_updatedAt_idx" ON "public"."RippleCounter"("waveId", "updatedAt");

-- CreateIndex
CREATE INDEX "TrendingScore_rippleId_calculationType_idx" ON "public"."TrendingScore"("rippleId", "calculationType");

-- CreateIndex
CREATE INDEX "TrendingScore_waveId_score_calculatedAt_idx" ON "public"."TrendingScore"("waveId", "score", "calculatedAt");

-- CreateIndex
CREATE INDEX "ActionLog_microActionId_idx" ON "public"."ActionLog"("microActionId");

-- CreateIndex
CREATE INDEX "ActionLog_waveId_idx" ON "public"."ActionLog"("waveId");

-- CreateIndex
CREATE INDEX "MicroAction_templateId_idx" ON "public"."MicroAction"("templateId");

-- CreateIndex
CREATE INDEX "MicroAction_status_idx" ON "public"."MicroAction"("status");

-- CreateIndex
CREATE INDEX "Ripple_status_idx" ON "public"."Ripple"("status");

-- CreateIndex
CREATE INDEX "Template_status_idx" ON "public"."Template"("status");

-- CreateIndex
CREATE INDEX "UserRipple_rippleId_idx" ON "public"."UserRipple"("rippleId");

-- AddForeignKey
ALTER TABLE "public"."WaveBucket" ADD CONSTRAINT "WaveBucket_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRipple" ADD CONSTRAINT "UserRipple_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRipple" ADD CONSTRAINT "UserRipple_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RippleActivity" ADD CONSTRAINT "RippleActivity_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RippleSummary" ADD CONSTRAINT "RippleSummary_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ripple" ADD CONSTRAINT "Ripple_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MicroAction" ADD CONSTRAINT "MicroAction_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MicroAction" ADD CONSTRAINT "MicroAction_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_microActionId_fkey" FOREIGN KEY ("microActionId") REFERENCES "public"."MicroAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_waveId_bucket_fkey" FOREIGN KEY ("waveId", "bucket") REFERENCES "public"."WaveBucket"("waveId", "name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BucketWeight" ADD CONSTRAINT "BucketWeight_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImpactCalculation" ADD CONSTRAINT "ImpactCalculation_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImpactCalculation" ADD CONSTRAINT "ImpactCalculation_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImpactIndex" ADD CONSTRAINT "ImpactIndex_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImpactIndex" ADD CONSTRAINT "ImpactIndex_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserImpactSummary" ADD CONSTRAINT "UserImpactSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RippleCounter" ADD CONSTRAINT "RippleCounter_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RippleCounter" ADD CONSTRAINT "RippleCounter_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrendingScore" ADD CONSTRAINT "TrendingScore_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrendingScore" ADD CONSTRAINT "TrendingScore_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
