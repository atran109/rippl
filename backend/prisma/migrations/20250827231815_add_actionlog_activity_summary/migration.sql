-- CreateTable
CREATE TABLE "public"."RippleActivity" (
    "id" TEXT NOT NULL,
    "rippleId" TEXT NOT NULL,
    "city" TEXT,
    "blurb" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RippleActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RippleSummary" (
    "rippleId" TEXT NOT NULL,
    "participants" INTEGER NOT NULL,
    "actionsTotal" INTEGER NOT NULL,
    "impactValue" DOUBLE PRECISION NOT NULL,
    "impactUnit" TEXT NOT NULL,
    "impactSource" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RippleSummary_pkey" PRIMARY KEY ("rippleId")
);

-- CreateTable
CREATE TABLE "public"."ActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "microActionId" TEXT NOT NULL,
    "rippleId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "city" TEXT,
    "noteText" TEXT,
    "shareAnon" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RippleActivity_rippleId_createdAt_idx" ON "public"."RippleActivity"("rippleId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionLog_rippleId_createdAt_idx" ON "public"."ActionLog"("rippleId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionLog_rippleId_bucket_idx" ON "public"."ActionLog"("rippleId", "bucket");

-- CreateIndex
CREATE INDEX "ActionLog_userId_createdAt_idx" ON "public"."ActionLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."RippleActivity" ADD CONSTRAINT "RippleActivity_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RippleSummary" ADD CONSTRAINT "RippleSummary_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_microActionId_fkey" FOREIGN KEY ("microActionId") REFERENCES "public"."MicroAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionLog" ADD CONSTRAINT "ActionLog_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
