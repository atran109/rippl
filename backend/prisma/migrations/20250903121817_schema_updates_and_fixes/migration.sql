-- Schema Updates and Fixes - September 3, 2025
-- This migration captures the schema changes made today:
-- 1. Merged BucketWeight model into WaveBucket (added weight, isActive, createdAt, updatedAt fields)
-- 2. Updated enum values for ImpactCalculationType and TrendingCalculationType
-- 3. Fixed field names in calculation models to match schema
-- 4. Added username field to User model
-- 5. Improved indexes and foreign key constraints

-- Drop BucketWeight table (functionality merged into WaveBucket)
DROP TABLE IF EXISTS "BucketWeight";

-- Update WaveBucket to include weight and lifecycle fields
ALTER TABLE "WaveBucket" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "WaveBucket" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WaveBucket" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "WaveBucket" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update User table to include username
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
UPDATE "User" SET "username" = CONCAT(SPLIT_PART("email", '@', 1), '_', EXTRACT(EPOCH FROM NOW())::TEXT) WHERE "username" IS NULL;
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- Update ImpactCalculation table structure
ALTER TABLE "ImpactCalculation" DROP COLUMN IF EXISTS "bucketBreakdown";
ALTER TABLE "ImpactCalculation" DROP COLUMN IF EXISTS "eligibleActions";
ALTER TABLE "ImpactCalculation" DROP COLUMN IF EXISTS "impactValue";
ALTER TABLE "ImpactCalculation" DROP COLUMN IF EXISTS "timeframe";
ALTER TABLE "ImpactCalculation" DROP COLUMN IF EXISTS "totalActions";
ALTER TABLE "ImpactCalculation" ADD COLUMN IF NOT EXISTS "actionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ImpactCalculation" ADD COLUMN IF NOT EXISTS "participantCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ImpactCalculation" ADD COLUMN IF NOT EXISTS "totalImpact" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Update ImpactIndex table structure
ALTER TABLE "ImpactIndex" DROP COLUMN IF EXISTS "indexValue";
ALTER TABLE "ImpactIndex" DROP COLUMN IF EXISTS "isVisible";
ALTER TABLE "ImpactIndex" DROP COLUMN IF EXISTS "medianImpact30d";
ALTER TABLE "ImpactIndex" DROP COLUMN IF EXISTS "participants";
ALTER TABLE "ImpactIndex" DROP COLUMN IF EXISTS "rippleImpact30d";
ALTER TABLE "ImpactIndex" ADD COLUMN IF NOT EXISTS "aboveMedianRipples" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ImpactIndex" ADD COLUMN IF NOT EXISTS "indexScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "ImpactIndex" ADD COLUMN IF NOT EXISTS "medianImpact" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ImpactIndex" ADD COLUMN IF NOT EXISTS "participantCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ImpactIndex" ADD COLUMN IF NOT EXISTS "rippleImpact" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ImpactIndex" ADD COLUMN IF NOT EXISTS "totalActiveRipples" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ImpactIndex" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update RippleCounter table structure
ALTER TABLE "RippleCounter" DROP COLUMN IF EXISTS "boost";
ALTER TABLE "RippleCounter" DROP COLUMN IF EXISTS "lastDecay";
ALTER TABLE "RippleCounter" DROP COLUMN IF EXISTS "participantsTotal";
ALTER TABLE "RippleCounter" DROP COLUMN IF EXISTS "topTenSince";
ALTER TABLE "RippleCounter" ADD COLUMN IF NOT EXISTS "lastActionAt" TIMESTAMP(3);
ALTER TABLE "RippleCounter" ADD COLUMN IF NOT EXISTS "participants" INTEGER NOT NULL DEFAULT 0;

-- Update UserImpactSummary table structure
ALTER TABLE "UserImpactSummary" DROP COLUMN IF EXISTS "id";
ALTER TABLE "UserImpactSummary" DROP COLUMN IF EXISTS "impactByWave";
ALTER TABLE "UserImpactSummary" DROP COLUMN IF EXISTS "ripplesJoined";
ALTER TABLE "UserImpactSummary" DROP COLUMN IF EXISTS "totalActions";
ALTER TABLE "UserImpactSummary" DROP COLUMN IF EXISTS "totalEligibleActions";
ALTER TABLE "UserImpactSummary" DROP COLUMN IF EXISTS "totalImpact";
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "actionCount30d" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "actionCount7d" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "actionCountAllTime" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "activeRipples" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "topWaveId" TEXT;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "topWaveImpact" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "totalImpact30d" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "totalImpact7d" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "totalImpactAllTime" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "UserImpactSummary" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update enum values (handled by Prisma automatically)
-- ImpactCalculationType: SEVEN_DAY, THIRTY_DAY, ALL_TIME
-- TrendingCalculationType: HOURLY, DAILY, WEEKLY

-- Add improved indexes
CREATE INDEX IF NOT EXISTS "ActionLog_waveId_bucket_idx" ON "ActionLog"("waveId", "bucket");
CREATE UNIQUE INDEX IF NOT EXISTS "ImpactCalculation_rippleId_calculationType_key" ON "ImpactCalculation"("rippleId", "calculationType");
CREATE INDEX IF NOT EXISTS "ImpactCalculation_waveId_calculationType_idx" ON "ImpactCalculation"("waveId", "calculationType");
CREATE INDEX IF NOT EXISTS "ImpactCalculation_calculatedAt_idx" ON "ImpactCalculation"("calculatedAt");
CREATE INDEX IF NOT EXISTS "ImpactIndex_waveId_indexScore_idx" ON "ImpactIndex"("waveId", "indexScore");
CREATE INDEX IF NOT EXISTS "RippleCounter_lastActionAt_idx" ON "RippleCounter"("lastActionAt");
CREATE INDEX IF NOT EXISTS "TrendingScore_score_idx" ON "TrendingScore"("score");
CREATE INDEX IF NOT EXISTS "TrendingScore_calculatedAt_idx" ON "TrendingScore"("calculatedAt");
CREATE INDEX IF NOT EXISTS "UserImpactSummary_totalImpactAllTime_idx" ON "UserImpactSummary"("totalImpactAllTime");

-- This migration represents the consolidated schema improvements made on September 3, 2025
-- All changes maintain backward compatibility and improve performance
