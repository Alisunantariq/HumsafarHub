const { SubscriptionState } = require("@prisma/client");
const prisma = require("../db");

function isSubscriptionTestMode() {
  return process.env.NODE_ENV === "development" &&
    process.env.SUBSCRIPTION_TEST_MODE === "true";
}

function hasSubscriptionAccess(subscription, now = new Date()) {
  if (!subscription) return false;
  if (subscription.status === SubscriptionState.ACTIVE) {
    return !subscription.currentPeriodEnd || subscription.currentPeriodEnd > now;
  }
  if (subscription.status === SubscriptionState.PAST_DUE) {
    return Boolean(
      subscription.lastPaidAt &&
      (
        subscription.currentPeriodEnd > now ||
        subscription.gracePeriodEndsAt > now
      ),
    );
  }
  if (subscription.status === SubscriptionState.CANCELLED) {
    return Boolean(subscription.currentPeriodEnd && subscription.currentPeriodEnd > now);
  }
  return false;
}

async function getUserSubscription(userId) {
  return prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

function getSubscriptionAccess(user, subscription) {
  if (isSubscriptionTestMode() && user?.role === "MATCHMAKER") return true;
  return hasSubscriptionAccess(subscription);
}

module.exports = {
  hasSubscriptionAccess,
  getUserSubscription,
  getSubscriptionAccess,
  isSubscriptionTestMode,
};