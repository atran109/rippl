-- AlterTable
ALTER TABLE "public"."Ripple" ADD COLUMN     "isStarter" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRipple" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rippleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRipple_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Dream_userId_key" ON "public"."Dream"("userId");

-- CreateIndex
CREATE INDEX "Dream_waveId_idx" ON "public"."Dream"("waveId");

-- CreateIndex
CREATE INDEX "UserRipple_userId_isPrimary_idx" ON "public"."UserRipple"("userId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "UserRipple_userId_rippleId_key" ON "public"."UserRipple"("userId", "rippleId");

-- AddForeignKey
ALTER TABLE "public"."Dream" ADD CONSTRAINT "Dream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dream" ADD CONSTRAINT "Dream_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "public"."Wave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRipple" ADD CONSTRAINT "UserRipple_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRipple" ADD CONSTRAINT "UserRipple_rippleId_fkey" FOREIGN KEY ("rippleId") REFERENCES "public"."Ripple"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
