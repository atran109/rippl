-- CreateTable
CREATE TABLE "public"."Wave" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "impactCoef" DOUBLE PRECISION NOT NULL,
    "impactUnit" TEXT NOT NULL,
    "impactSource" TEXT NOT NULL,
    "allowedBuckets" TEXT NOT NULL,

    CONSTRAINT "Wave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ripple" (
    "id" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "status" TEXT NOT NULL DEFAULT 'active',
    "audience_noun" TEXT,
    "context_label" TEXT,
    "blurb_template" TEXT,
    "default_bucket" TEXT,

    CONSTRAINT "Ripple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MicroAction" (
    "id" TEXT NOT NULL,
    "rippleId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "bucket" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "MicroAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wave_name_key" ON "public"."Wave"("name");

-- CreateIndex
CREATE INDEX "Ripple_waveId_idx" ON "public"."Ripple"("waveId");

-- CreateIndex
CREATE INDEX "MicroAction_rippleId_idx" ON "public"."MicroAction"("rippleId");

-- AddForeignKey
ALTER TABLE "public"."Ripple" ADD CONSTRAINT "Ripple_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MicroAction" ADD CONSTRAINT "MicroAction_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
