const { Router } = require("express");
const prisma = require("../db");
const { authenticate } = require("../middleware/auth");
const { subscriptionPlans, getSafepayConfig } = require("../services/safepay");
const { isSubscriptionTestMode } = require("../services/subscription-access");

const router = Router();

router.get("/plans", (req, res) => {
  const testMode = isSubscriptionTestMode();
  return res.json({
    currency: "PKR",
    interval: "MONTH",
    plans: Object.entries(subscriptionPlans).map(([tier, plan]) => ({
      id: plan.id,
      tier,
      name: plan.name,
      amount: plan.amountPkr,
    })),
    provider: !testMode && getSafepayConfig() ? "SAFEPAY" : null,
    testMode,
  });
});

router.post("/checkout", authenticate, (req, res) => {
  return res.status(410).json({
    error: "One-time package checkout has been replaced by monthly subscriptions.",
    checkoutEndpoint: "/api/subscriptions/checkout/:tier",
  });
});

router.post("/safepay/return", (req, res) => {
  return res.status(410).json({
    error: "Payment redirects are not authoritative. Subscription status is updated only by verified Safepay webhooks.",
  });
});

router.get("/orders/:id", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.paymentOrder.findUnique({
      where: { id: req.params.id },
    });
    if (!order) return res.status(404).json({ error: "Payment order not found." });
    if (order.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "You may not view this payment order." });
    }
    const { userId, tracker, providerReference, ...publicOrder } = order;
    return res.json({ order: publicOrder });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
