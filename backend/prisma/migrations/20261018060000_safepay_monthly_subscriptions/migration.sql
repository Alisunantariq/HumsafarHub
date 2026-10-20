CREATE TYPE "SubscriptionState" AS ENUM (
    'PENDING',
    'ACTIVE',
    'PAYMENT_FAILED',
    'PAST_DUE',
    'CANCELLED',
    'EXPIRED'
);

CREATE TYPE "SubscriptionPaymentState" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED'
);

CREATE TYPE "SubscriptionCheckoutState" AS ENUM (
    'PENDING',
    'READY',
    'FAILED'
);

CREATE TYPE "WebhookEventState" AS ENUM (
    'PENDING',
    'PROCESSING',
    'PROCESSED',
    'FAILED'
);

CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(80) NOT NULL,
    "userId" UUID NOT NULL,
    "providerSubscriptionId" VARCHAR(255),
    "providerPlanId" VARCHAR(255) NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'PKR',
    "status" "SubscriptionState" NOT NULL DEFAULT 'PENDING',
    "checkoutStatus" "SubscriptionCheckoutState" NOT NULL DEFAULT 'PENDING',
    "latestPaymentStatus" "SubscriptionPaymentState" NOT NULL DEFAULT 'PENDING',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "lastPaidAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "cancellationRequestedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastTransactionId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPayment" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "providerTransactionId" VARCHAR(255) NOT NULL,
    "status" "SubscriptionPaymentState" NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'PKR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionWebhookEvent" (
    "id" UUID NOT NULL,
    "providerEventId" VARCHAR(255) NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" VARCHAR(1000),

    CONSTRAINT "SubscriptionWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_reference_key" ON "Subscription"("reference");
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");
CREATE INDEX "Subscription_userId_status_createdAt_idx" ON "Subscription"("userId", "status", "createdAt");
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

CREATE UNIQUE INDEX "SubscriptionPayment_providerTransactionId_key" ON "SubscriptionPayment"("providerTransactionId");
CREATE INDEX "SubscriptionPayment_subscriptionId_createdAt_idx" ON "SubscriptionPayment"("subscriptionId", "createdAt");

CREATE UNIQUE INDEX "SubscriptionWebhookEvent_providerEventId_key" ON "SubscriptionWebhookEvent"("providerEventId");
CREATE INDEX "SubscriptionWebhookEvent_status_receivedAt_idx" ON "SubscriptionWebhookEvent"("status", "receivedAt");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
