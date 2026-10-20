const { randomUUID } = require("node:crypto");
const { Router } = require("express");
const { SubscriptionCheckoutState, SubscriptionState } = require("@prisma/client");
const prisma = require("../db");
const { authenticate } = require("../middleware/auth");
const {
  subscriptionPlans,
  getSafepayConfig,
  getSafepayConfigurationErrors,
  getPlanForTier,
  createSubscriptionCheckout,
  verifyWebhookSignature,
} = require("../services/safepay");
const { scheduleWebhookDrain } = require("../services/subscription-webhooks");
const {
  getUserSubscription,
  hasSubscriptionAccess,
  getSubscriptionAccess,
  isSubscriptionTestMode,
} = require("../services/subscription-access");

const router = Router();

router.get("/plans", (req, res) => {
  const testMode = isSubscriptionTestMode();
  const configurationErrors = getSafepayConfigurationErrors();
  const plans = Object.entries(subscriptionPlans).map(([tier, plan]) => ({
    id: plan.id,
    tier,
    name: plan.name,
    amount: plan.amountPkr,
    currency: "PKR",
    interval: "MONTH",
    intervalCount: 1,
  }));
  return res.json({
    currency: "PKR",
    interval: "MONTH",
    plans,
    provider: !testMode && getSafepayConfig() ? "SAFEPAY" : null,
    testMode,
    checkoutUnavailableReason: testMode
      ? "Safepay payments are disabled in local testing mode."
      : configurationErrors.length
        ? "Safepay checkout is not fully configured. Contact the platform administrator."
        : null,
  });
});

router.post("/test-access/:tier", authenticate, async (req, res, next) => {
  if (!isSubscriptionTestMode()) {
    return res.status(404).json({ error: "Free testing access is unavailable." });
  }
  if (req.user.role !== "MATCHMAKER") {
    return res.status(403).json({ error: "Only matchmaker accounts can select a test package." });
  }
  const tier = typeof req.params.tier === "string" ? req.params.tier.toUpperCase() : "";
  if (!["NORMAL", "GOLDEN"].includes(tier)) {
    return res.status(400).json({ error: "tier must be normal or golden." });
  }
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { subscriptionPlan: tier },
    });
    return res.json({
      tier,
      testMode: true,
      message: "Test package selected. Administrator approval is still required.",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/checkout/:tier", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "MATCHMAKER") {
      return res.status(403).json({ error: "Only matchmaker accounts can subscribe." });
    }
    if (isSubscriptionTestMode()) {
      return res.status(503).json({ error: "Safepay checkout is disabled in local testing mode." });
    }
    const tier = typeof req.params.tier === "string" ? req.params.tier.toLowerCase() : "";
    const plan = getPlanForTier(tier);
    if (!plan) {
      return res.status(400).json({ error: "tier must be normal or golden, with its Safepay plan configured." });
    }
    const config = getSafepayConfig();
    if (!config) {
      return res.status(503).json({ error: "Safepay subscription checkout is not configured yet." });
    }
    const reference = `subref_${randomUUID()}`;
    const checkout = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${req.user.id}::uuid FOR UPDATE`;
      const existingSubscription = await transaction.subscription.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
      });
      if (
        existingSubscription &&
        (
          hasSubscriptionAccess(existingSubscription) ||
          (existingSubscription.status === SubscriptionState.PENDING &&
            existingSubscription.checkoutStatus === SubscriptionCheckoutState.READY)
        )
      ) {
        return { conflict: true };
      }
      const subscription = await transaction.subscription.create({
        data: {
          reference,
          userId: req.user.id,
          providerPlanId: plan.providerPlanId,
          tier: plan.id,
          amountPkr: plan.amountPkr,
          currency: "PKR",
        },
        select: { id: true, reference: true, tier: true, amountPkr: true, currency: true },
      });
      return { subscription };
    });
    if (checkout.conflict) {
      return res.status(409).json({
        error: "You already have an active or pending subscription. Manage that subscription before starting another checkout.",
      });
    }
    const { subscription } = checkout;

    try {
      const checkoutUrl = await createSubscriptionCheckout({
        config,
        plan,
        reference: subscription.reference,
        redirectUrl: `${config.appUrl}/payment/result?reference=${encodeURIComponent(subscription.reference)}`,
        cancelUrl: `${config.appUrl}/payment/result?reference=${encodeURIComponent(subscription.reference)}&status=cancelled`,
      });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { checkoutStatus: SubscriptionCheckoutState.READY },
      });
      return res.status(201).json({
        reference: subscription.reference,
        tier: tier.toUpperCase(),
        amountPkr: subscription.amountPkr,
        currency: subscription.currency,
        interval: "MONTH",
        checkoutUrl,
      });
    } catch (error) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { checkoutStatus: SubscriptionCheckoutState.FAILED },
      });
      console.error("Safepay subscription checkout initialization failed:", error.code || "PROVIDER_ERROR");
      return res.status(502).json({ error: "Safepay could not start checkout. Please try again." });
    }
  } catch (error) {
    return next(error);
  }
});

router.get("/current", authenticate, async (req, res, next) => {
  try {
    const subscription = await getUserSubscription(req.user.id);
    if (!subscription) {
      return res.json({
        subscription: null,
        hasAccess: await getSubscriptionAccess(req.user, null),
      });
    }
    return res.json({
      subscription: {
        reference: subscription.reference,
        tier: subscription.tier,
        amountPkr: subscription.amountPkr,
        currency: subscription.currency,
        status: subscription.status,
        checkoutStatus: subscription.checkoutStatus,
        latestPaymentStatus: subscription.latestPaymentStatus,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt,
        cancellationRequestedAt: subscription.cancellationRequestedAt,
        cancelledAt: subscription.cancelledAt,
        createdAt: subscription.createdAt,
      },
      hasAccess: await getSubscriptionAccess(req.user, subscription),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:reference", authenticate, async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { reference: req.params.reference },
    });
    if (!subscription) return res.status(404).json({ error: "Subscription not found." });
    if (subscription.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "You may not view this subscription." });
    }
    return res.json({
      subscription: {
        reference: subscription.reference,
        tier: subscription.tier,
        amountPkr: subscription.amountPkr,
        currency: subscription.currency,
        status: subscription.status,
        checkoutStatus: subscription.checkoutStatus,
        latestPaymentStatus: subscription.latestPaymentStatus,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt,
        cancellationRequestedAt: subscription.cancellationRequestedAt,
        cancelledAt: subscription.cancelledAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

async function handleSafepayWebhook(req, res, next) {
  try {
    if (isSubscriptionTestMode()) {
      return res.status(503).json({ error: "Safepay webhooks are disabled in local testing mode." });
    }
    const config = getSafepayConfig();
    const rawBody = req.body;
    const signature = req.get("x-sfpy-signature");
    if (!config || !verifyWebhookSignature(rawBody, signature, config.webhookSecret)) {
      return res.status(401).json({ error: "Invalid webhook signature." });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Webhook body must be valid JSON." });
    }
    if (
      !event ||
      typeof event.id !== "string" ||
      !event.id.trim() ||
      typeof event.type !== "string" ||
      !event.type.trim() ||
      !event.data ||
      typeof event.data !== "object" ||
      Array.isArray(event.data)
    ) {
      return res.status(400).json({ error: "Webhook event is missing a valid id, type, or data object." });
    }

    try {
      await prisma.subscriptionWebhookEvent.create({
        data: { providerEventId: event.id, type: event.type, payload: event },
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(200).json({ received: true, duplicate: true });
      }
      return next(error);
    }

    res.status(200).json({ received: true });
    scheduleWebhookDrain();
  } catch (error) {
    return next(error);
  }
}

module.exports = { router, handleSafepayWebhook };