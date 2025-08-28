/*
  Warnings:

  - Added the required column `waveId` to the `MicroAction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TemplateStatus" AS ENUM ('active', 'inactive', 'archived');

-- AlterTable
ALTER TABLE "public"."MicroAction" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "waveId" TEXT;

-- CreateTable
CREATE TABLE "public"."WaveBucket" (
    "waveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "WaveBucket_pkey" PRIMARY KEY ("waveId","name")
);

-- CreateTable
CREATE TABLE "public"."Template" (
    "id" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "textPattern" TEXT NOT NULL,
    "modifiersJson" JSONB NOT NULL DEFAULT '{}',
    "status" "public"."TemplateStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_waveId_bucket_idx" ON "public"."Template"("waveId", "bucket");

-- CreateIndex
CREATE INDEX "MicroAction_waveId_bucket_idx" ON "public"."MicroAction"("waveId", "bucket");

-- AddForeignKey
ALTER TABLE "public"."WaveBucket" ADD CONSTRAINT "WaveBucket_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Populate WaveBucket table from existing Wave.allowedBuckets
INSERT INTO "public"."WaveBucket" ("waveId", "name")
SELECT w."id" as "waveId", 
       trim(bucket_name) as "name"
FROM "public"."Wave" w
CROSS JOIN LATERAL unnest(string_to_array(w."allowedBuckets", ',')) AS bucket_name
WHERE trim(bucket_name) != '';

-- Populate waveId for existing MicroActions by looking up through Ripple
UPDATE "public"."MicroAction" 
SET "waveId" = (
  SELECT r."waveId" 
  FROM "public"."Ripple" r 
  WHERE r."id" = "public"."MicroAction"."rippleId"
)
WHERE "waveId" IS NULL;

-- Make waveId required after populating it
ALTER TABLE "public"."MicroAction" ALTER COLUMN "waveId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_waveId_bucket_fkey" FOREIGN KEY ("waveId", "bucket") REFERENCES "public"."WaveBucket"("waveId", "name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MicroAction" ADD CONSTRAINT "MicroAction_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MicroAction" ADD CONSTRAINT "MicroAction_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MicroAction" ADD CONSTRAINT "MicroAction_waveId_bucket_fkey" FOREIGN KEY ("waveId", "bucket") REFERENCES "public"."WaveBucket"("waveId", "name") ON DELETE RESTRICT ON UPDATE CASCADE;
