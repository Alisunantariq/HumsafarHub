CREATE TYPE "PlanTier" AS ENUM ('NORMAL', 'GOLDEN');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

ALTER TABLE "User" ADD COLUMN "subscriptionPlan" "PlanTier";

ALTER TABLE "ClientProfile"
    ADD COLUMN "clientOrigin" VARCHAR(80),
    ADD COLUMN "preferences" VARCHAR(1000),
    ADD COLUMN "description" VARCHAR(2000),
    ADD COLUMN "requirements" VARCHAR(2000);

CREATE TABLE "PaymentOrder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "plan" "PlanTier" NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(40) NOT NULL DEFAULT 'SAFEPAY',
    "tracker" VARCHAR(255),
    "providerReference" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentOrder_tracker_key" ON "PaymentOrder"("tracker");
CREATE INDEX "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt");
CREATE INDEX "PaymentOrder_status_createdAt_idx" ON "PaymentOrder"("status", "createdAt");

ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
