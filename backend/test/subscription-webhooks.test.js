const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SubscriptionPaymentState,
  SubscriptionState,
  SubscriptionStatus,
} = require("@prisma/client");
const { hasSubscriptionAccess } = require("../src/services/subscription-access");
const { processSubscriptionWebhook } = require("../src/services/subscription-webhooks");

function createTransaction(subscription, existingPayment = null) {
  const calls = { paymentCreates: [], subscriptionUpdates: [], userUpdates: [] };
  return {
    calls,
    subscription: {
      findUnique: async () => subscription,
      update: async (args) => calls.subscriptionUpdates.push(args),
    },
    subscriptionPayment: {
      findUnique: async () => existingPayment,
      create: async (args) => calls.paymentCreates.push(args),
    },
    user: {
      update: async (args) => calls.userUpdates.push(args),
    },
  };
}

function subscription(overrides = {}) {
  return {
    id: "sub_test",
    reference: "subref_test",
    userId: "user_test",
    providerSubscriptionId: null,
    providerPlanId: "plan_normal",
    tier: "NORMAL",
    amountPkr: 10000,
    currency: "PKR",
    status: SubscriptionState.PENDING,
    latestPaymentStatus: SubscriptionPaymentState.PENDING,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    lastPaidAt: null,
    gracePeriodEndsAt: null,
    cancellationRequestedAt: null,
    ...overrides,
  };
}

test("successful subscription payment activates the matching plan exactly once", async () => {
  const tx = createTransaction(subscription());
  await processSubscriptionWebhook(tx, {
    type: "subscription.payment.succeeded",
    data: {
      reference: "subref_test",
      subscription_id: "provider-sub-1",
      transaction_id: "provider-txn-1",
    },
  });

  assert.equal(tx.calls.paymentCreates.length, 1);
  assert.equal(tx.calls.paymentCreates[0].data.amountPkr, 10000);
  assert.equal(tx.calls.paymentCreates[0].data.status, SubscriptionPaymentState.SUCCEEDED);
  assert.equal(tx.calls.subscriptionUpdates[0].data.status, SubscriptionState.ACTIVE);
  assert.equal(tx.calls.subscriptionUpdates[0].data.providerSubscriptionId, "provider-sub-1");
  assert.equal(tx.calls.userUpdates[0].data.subscriptionStatus, SubscriptionStatus.ACTIVE);
  assert.equal(tx.calls.subscriptionUpdates[0].data.currentPeriodEnd.getUTCMonth(),
    (tx.calls.subscriptionUpdates[0].data.currentPeriodStart.getUTCMonth() + 1) % 12);
});

test("failed renewal preserves access through the already-paid period and then grace", async () => {
  const periodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const tx = createTransaction(subscription({
    status: SubscriptionState.ACTIVE,
    currentPeriodEnd: periodEnd,
    lastPaidAt: new Date(),
  }));
  await processSubscriptionWebhook(tx, {
    type: "subscription.payment.failed",
    data: {
      reference: "subref_test",
      subscription_id: "provider-sub-1",
    },
  });

  const update = tx.calls.subscriptionUpdates[0].data;
  assert.equal(update.status, SubscriptionState.PAST_DUE);
  assert.ok(update.gracePeriodEndsAt > periodEnd);
  assert.equal(tx.calls.userUpdates[0].data.subscriptionStatus, SubscriptionStatus.PAST_DUE);
  assert.equal(hasSubscriptionAccess({
    ...subscription({ status: SubscriptionState.PAST_DUE }),
    lastPaidAt: new Date(),
    currentPeriodEnd: periodEnd,
    gracePeriodEndsAt: update.gracePeriodEndsAt,
  }), true);
  assert.equal(hasSubscriptionAccess({
    ...subscription({ status: SubscriptionState.PAST_DUE }),
    lastPaidAt: new Date("2025-01-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2025-01-01T00:00:00.000Z"),
    gracePeriodEndsAt: new Date("2025-01-04T00:00:00.000Z"),
  }), false);
});

test("a duplicate provider transaction does not activate or record a second payment", async () => {
  const tx = createTransaction(subscription(), { id: "already-recorded" });
  await processSubscriptionWebhook(tx, {
    type: "subscription.payment.succeeded",
    data: {
      reference: "subref_test",
      subscription_id: "provider-sub-1",
      transaction_id: "provider-txn-1",
    },
  });

  assert.deepEqual(tx.calls.paymentCreates, []);
  assert.deepEqual(tx.calls.subscriptionUpdates, []);
  assert.deepEqual(tx.calls.userUpdates, []);
});

test("unmatched subscription references fail closed", async () => {
  const tx = createTransaction(null);
  await assert.rejects(
    processSubscriptionWebhook(tx, {
      type: "subscription.payment.succeeded",
      data: {
        reference: "subref_missing",
        subscription_id: "provider-sub-1",
        transaction_id: "provider-txn-1",
      },
    }),
    (error) => error.code === "SUBSCRIPTION_REFERENCE_NOT_FOUND",
  );
  assert.deepEqual(tx.calls.userUpdates, []);
});
