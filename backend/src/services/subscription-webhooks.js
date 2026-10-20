const {
  SubscriptionPaymentState,
  SubscriptionState,
  WebhookEventState,
  SubscriptionStatus,
} = require("@prisma/client");
const prisma = require("../db");
const {
  getPlanForTier,
  nextBillingPeriodStart,
  addOneCalendarMonth,
} = require("./safepay");

const STALE_LOCK_MS = 2 * 60 * 1000;
let drainScheduled = false;

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`Safepay subscription event is missing ${field}.`);
    error.code = "INVALID_SUBSCRIPTION_EVENT";
    throw error;
  }
  return value.trim();
}

async function findCorrelatedSubscription(transaction, data) {
  const reference = requiredText(data.reference, "data.reference");
  const subscription = await transaction.subscription.findUnique({ where: { reference } });
  if (!subscription) {
    const error = new Error("Safepay event reference does not match a pending subscription.");
    error.code = "SUBSCRIPTION_REFERENCE_NOT_FOUND";
    throw error;
  }

  const providerSubscriptionId = data.subscription_id || data.sub_id;
  if (providerSubscriptionId !== undefined) {
    requiredText(providerSubscriptionId, "data.subscription_id");
    if (subscription.providerSubscriptionId && subscription.providerSubscriptionId !== providerSubscriptionId) {
      const error = new Error("Safepay subscription ID does not match the stored subscription.");
      error.code = "SUBSCRIPTION_ID_MISMATCH";
      throw error;
    }
  }

  if (data.plan_id !== undefined) {
    const plan = getPlanForTier(subscription.tier.toLowerCase());
    if (!plan || data.plan_id !== plan.providerPlanId || subscription.providerPlanId !== data.plan_id) {
      const error = new Error("Safepay plan ID does not match the selected tier.");
      error.code = "SUBSCRIPTION_PLAN_MISMATCH";
      throw error;
    }
  }
  return { subscription, providerSubscriptionId };
}

async function processSubscriptionWebhook(transaction, event) {
  if (!event || typeof event.type !== "string" || !event.data || typeof event.data !== "object" || Array.isArray(event.data)) {
    const error = new Error("Safepay subscription webhook has an unexpected payload.");
    error.code = "INVALID_SUBSCRIPTION_EVENT";
    throw error;
  }
  const { type, data } = event;

  if (type === "payment.succeeded") return;

  if (type === "subscription.created") {
    const { subscription, providerSubscriptionId } = await findCorrelatedSubscription(transaction, data);
    requiredText(providerSubscriptionId, "data.subscription_id");
    await transaction.subscription.update({
      where: { id: subscription.id },
      data: { providerSubscriptionId },
    });
    return;
  }

  if (type === "subscription.payment.succeeded") {
    const { subscription, providerSubscriptionId } = await findCorrelatedSubscription(transaction, data);
    requiredText(providerSubscriptionId, "data.subscription_id");
    if (subscription.status === SubscriptionState.EXPIRED) return;

    const transactionId = requiredText(data.transaction_id, "data.transaction_id");
    const alreadyRecorded = await transaction.subscriptionPayment.findUnique({
      where: { providerTransactionId: transactionId },
      select: { id: true },
    });
    if (alreadyRecorded) return;

    const now = new Date();
    const periodStart = nextBillingPeriodStart(subscription.currentPeriodEnd, now);
    const periodEnd = addOneCalendarMonth(periodStart);
    await transaction.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        providerTransactionId: transactionId,
        status: SubscriptionPaymentState.SUCCEEDED,
        amountPkr: subscription.amountPkr,
        currency: subscription.currency,
      },
    });
    const remainsCancelled = subscription.status === SubscriptionState.CANCELLED;
    await transaction.subscription.update({
      where: { id: subscription.id },
      data: {
        providerSubscriptionId,
        status: remainsCancelled ? SubscriptionState.CANCELLED : SubscriptionState.ACTIVE,
        latestPaymentStatus: SubscriptionPaymentState.SUCCEEDED,
        lastTransactionId: transactionId,
        lastPaidAt: now,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
      },
    });
    await transaction.user.update({
      where: { id: subscription.userId },
      data: remainsCancelled
        ? { subscriptionStatus: SubscriptionStatus.CANCELED }
        : {
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            subscriptionPlan: subscription.tier,
          },
    });
    return;
  }

  if (type === "subscription.payment.failed") {
    const { subscription, providerSubscriptionId } = await findCorrelatedSubscription(transaction, data);
    requiredText(providerSubscriptionId, "data.subscription_id");
    if (subscription.status === SubscriptionState.CANCELLED || subscription.status === SubscriptionState.EXPIRED) return;

    const graceDays = Number(process.env.SUBSCRIPTION_GRACE_DAYS || 3);
    const gracePeriodStartsAt = subscription.currentPeriodEnd > new Date()
      ? subscription.currentPeriodEnd
      : new Date();
    const gracePeriodEndsAt = subscription.lastPaidAt
      ? new Date(gracePeriodStartsAt.getTime() + graceDays * 24 * 60 * 60 * 1000)
      : null;
    const nextState = subscription.lastPaidAt
      ? SubscriptionState.PAST_DUE
      : SubscriptionState.PAYMENT_FAILED;
    await transaction.subscription.update({
      where: { id: subscription.id },
      data: {
        providerSubscriptionId,
        status: nextState,
        latestPaymentStatus: SubscriptionPaymentState.FAILED,
        gracePeriodEndsAt,
      },
    });
    await transaction.user.update({
      where: { id: subscription.userId },
      data: {
        subscriptionStatus: subscription.lastPaidAt
          ? SubscriptionStatus.PAST_DUE
          : SubscriptionStatus.INACTIVE,
      },
    });
    return;
  }

  if (type === "subscription.cancelled") {
    const { subscription, providerSubscriptionId } = await findCorrelatedSubscription(transaction, data);
    requiredText(providerSubscriptionId, "data.subscription_id");
    await transaction.subscription.update({
      where: { id: subscription.id },
      data: {
        providerSubscriptionId,
        status: SubscriptionState.CANCELLED,
        cancellationRequestedAt: subscription.cancellationRequestedAt || new Date(),
        cancelledAt: new Date(),
        gracePeriodEndsAt: null,
      },
    });
    await transaction.user.update({
      where: { id: subscription.userId },
      data: { subscriptionStatus: SubscriptionStatus.CANCELED },
    });
  }
}

async function processClaimedEvent(eventId) {
  const event = await prisma.subscriptionWebhookEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status !== WebhookEventState.PROCESSING) return;

  await prisma.$transaction(async (transaction) => {
    await processSubscriptionWebhook(transaction, event.payload);
    await transaction.subscriptionWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: WebhookEventState.PROCESSED,
        processedAt: new Date(),
        lockAt: null,
        lastError: null,
      },
    });
  });
}

async function drainWebhookQueue() {
  if (drainScheduled) return;
  drainScheduled = true;
  try {
    const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
    const events = await prisma.subscriptionWebhookEvent.findMany({
      where: {
        OR: [
          { status: WebhookEventState.PENDING },
          { status: WebhookEventState.PROCESSING, lockAt: { lt: staleBefore } },
        ],
      },
      orderBy: { receivedAt: "asc" },
      take: 25,
      select: { id: true, status: true },
    });

    for (const event of events) {
      const staleBeforeClaim = new Date(Date.now() - STALE_LOCK_MS);
      const claimed = await prisma.subscriptionWebhookEvent.updateMany({
        where: {
          id: event.id,
          OR: [
            { status: WebhookEventState.PENDING },
            { status: WebhookEventState.PROCESSING, lockAt: { lt: staleBeforeClaim } },
          ],
        },
        data: {
          status: WebhookEventState.PROCESSING,
          attempts: { increment: 1 },
          lockAt: new Date(),
        },
      });
      if (claimed.count !== 1) continue;

      try {
        await processClaimedEvent(event.id);
      } catch (error) {
        const permanentFailure = [
          "INVALID_SUBSCRIPTION_EVENT",
          "SUBSCRIPTION_REFERENCE_NOT_FOUND",
          "SUBSCRIPTION_ID_MISMATCH",
          "SUBSCRIPTION_PLAN_MISMATCH",
          "P2002",
        ].includes(error.code);
        await prisma.subscriptionWebhookEvent.updateMany({
          where: { id: event.id, status: WebhookEventState.PROCESSING },
          data: {
            status: permanentFailure ? WebhookEventState.FAILED : WebhookEventState.PENDING,
            lockAt: null,
            lastError: typeof error.code === "string" ? error.code.slice(0, 1000) : "PROCESSING_FAILED",
            ...(permanentFailure ? { processedAt: new Date() } : {}),
          },
        });
        console.error("Safepay webhook processing failed:", {
          eventId: event.id,
          code: error.code || "PROCESSING_FAILED",
        });
      }
    }
  } catch (error) {
    console.error("Safepay webhook queue poll failed:", error.code || "DATABASE_ERROR");
  } finally {
    drainScheduled = false;
  }
}

function scheduleWebhookDrain() {
  setImmediate(() => {
    void drainWebhookQueue();
  });
}

function startWebhookWorker() {
  const timer = setInterval(() => {
    void drainWebhookQueue();
  }, 2000);
  timer.unref();
  scheduleWebhookDrain();
  return timer;
}

module.exports = {
  processSubscriptionWebhook,
  drainWebhookQueue,
  scheduleWebhookDrain,
  startWebhookWorker,
};
