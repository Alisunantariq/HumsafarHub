const crypto = require("node:crypto");
const net = require("node:net");

const subscriptionPlans = Object.freeze({
  normal: Object.freeze({
    id: "NORMAL",
    name: "Normal Tier",
    amountPkr: 10000,
    environmentVariable: "SAFEPAY_NORMAL_PLAN_ID",
  }),
  golden: Object.freeze({
    id: "GOLDEN",
    name: "Golden Tier",
    amountPkr: 15000,
    environmentVariable: "SAFEPAY_GOLDEN_PLAN_ID",
  }),
});

let cachedAuthToken = null;

function validOrigin(value, { requireHttps = false, requirePublicHttps = false, allowPath = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (requireHttps && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (!allowPath && url.pathname !== "/")
    ) return false;
    if (requirePublicHttps) {
      const hostname = url.hostname.toLowerCase();
      const ip = hostname.replace(/^\[|\]$/g, "");
      const ipVersion = net.isIP(ip);
      if (
        url.protocol !== "https:" ||
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".test") ||
        hostname.endsWith(".invalid") ||
        hostname === "test" ||
        hostname === "example.com" ||
        hostname.endsWith(".example.com") ||
        hostname === "example.net" ||
        hostname.endsWith(".example.net") ||
        hostname === "example.org" ||
        hostname.endsWith(".example.org")
      ) return false;
      if (ipVersion === 4) {
        const [first, second] = ip.split(".").map(Number);
        if (
          first === 0 ||
          first === 10 ||
          first === 127 ||
          (first === 169 && second === 254) ||
          (first === 172 && second >= 16 && second <= 31) ||
          (first === 192 && second === 168)
        ) return false;
      } else if (ipVersion === 6 && (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:"))) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function hasConfiguredValue(value) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    !/^(replace-with|your[_-])/i.test(value.trim());
}

function getSafepayConfigurationErrors(environment = process.env) {
  const errors = [];
  const stage = environment.SAFEPAY_ENV || "sandbox";
  if (!["sandbox", "production"].includes(stage)) {
    errors.push("SAFEPAY_ENV must be sandbox or production.");
  }

  const expectedHost = stage === "production"
    ? "https://api.getsafepay.com"
    : "https://sandbox.api.getsafepay.com";
  const expectedCheckoutHost = stage === "production"
    ? "https://getsafepay.com"
    : "https://sandbox.api.getsafepay.com";
  if (environment.SAFEPAY_HOST !== expectedHost) {
    errors.push(`SAFEPAY_HOST must be ${expectedHost} for this environment.`);
  }
  if (environment.SAFEPAY_CHECKOUT_HOST !== expectedCheckoutHost) {
    errors.push(`SAFEPAY_CHECKOUT_HOST must be ${expectedCheckoutHost} for this environment.`);
  }
  if (!hasConfiguredValue(environment.SAFEPAY_SECRET_KEY)) errors.push("SAFEPAY_SECRET_KEY is missing or still uses a placeholder.");
  if (!hasConfiguredValue(environment.SAFEPAY_WEBHOOK_SECRET)) errors.push("SAFEPAY_WEBHOOK_SECRET is missing or still uses a placeholder.");

  for (const [tier, plan] of Object.entries(subscriptionPlans)) {
    const planId = tier === "normal"
      ? environment.SAFEPAY_NORMAL_MONTHLY_PLAN_ID || environment[plan.environmentVariable]
      : environment[plan.environmentVariable];
    if (!hasConfiguredValue(planId) || !/^plan_[A-Za-z0-9-]+$/.test(planId.trim())) {
      errors.push(`${plan.environmentVariable} must contain the ${tier} plan ID from this Safepay environment.`);
    }
  }
  if (!validOrigin(environment.APP_URL, { requireHttps: stage === "production" })) {
    errors.push("APP_URL must be a valid frontend origin; production requires HTTPS.");
  }
  if (!validOrigin(environment.SAFEPAY_WEBHOOK_URL, { requirePublicHttps: true, allowPath: true })) {
    errors.push("SAFEPAY_WEBHOOK_URL must be the public HTTPS URL Safepay calls for subscription webhooks.");
  }
  if (
    environment.SAFEPAY_WEBHOOK_URL &&
    !environment.SAFEPAY_WEBHOOK_URL.endsWith("/api/subscriptions/safepay/webhook")
  ) {
    errors.push("SAFEPAY_WEBHOOK_URL must end with /api/subscriptions/safepay/webhook.");
  }

  const graceDays = Number(environment.SUBSCRIPTION_GRACE_DAYS || 3);
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 30) {
    errors.push("SUBSCRIPTION_GRACE_DAYS must be a whole number from 0 to 30.");
  }
  return errors;
}

function getSafepayConfig() {
  if (getSafepayConfigurationErrors().length) return null;
  return {
    environment: process.env.SAFEPAY_ENV || "sandbox",
    host: process.env.SAFEPAY_HOST.replace(/\/+$/, ""),
    checkoutHost: process.env.SAFEPAY_CHECKOUT_HOST.replace(/\/+$/, ""),
    secretKey: process.env.SAFEPAY_SECRET_KEY.trim(),
    webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET.trim(),
    appUrl: process.env.APP_URL.replace(/\/+$/, ""),
    webhookUrl: process.env.SAFEPAY_WEBHOOK_URL,
    graceDays: Number(process.env.SUBSCRIPTION_GRACE_DAYS || 3),
  };
}

function getPlanForTier(tier, environment = process.env) {
  const plan = subscriptionPlans[tier];
  if (!plan) return null;
  const configuredPlanId = tier === "normal"
    ? environment.SAFEPAY_NORMAL_MONTHLY_PLAN_ID || environment[plan.environmentVariable]
    : environment[plan.environmentVariable];
  const providerPlanId = configuredPlanId?.trim();
  if (!hasConfiguredValue(providerPlanId) || !/^plan_[A-Za-z0-9-]+$/.test(providerPlanId)) return null;
  return { ...plan, providerPlanId };
}

async function getAuthToken(config) {
  const now = Date.now();
  if (
    cachedAuthToken &&
    cachedAuthToken.host === config.host &&
    cachedAuthToken.secretKey === config.secretKey &&
    now < cachedAuthToken.expiresAt
  ) return cachedAuthToken.value;

  let response;
  try {
    response = await fetch(`${config.host}/client/passport/v1/token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-SFPY-MERCHANT-SECRET": config.secretKey,
      },
      body: "{}",
      signal: AbortSignal.timeout(15000),
    });
  } catch (cause) {
    const error = new Error("Safepay could not issue a checkout token.");
    error.code = "SAFEPAY_TOKEN_REQUEST_FAILED";
    error.cause = cause;
    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || typeof payload?.data !== "string" || !payload.data) {
    const error = new Error("Safepay could not issue a checkout token.");
    error.code = "SAFEPAY_TOKEN_REQUEST_FAILED";
    throw error;
  }

  cachedAuthToken = {
    value: payload.data,
    host: config.host,
    secretKey: config.secretKey,
    expiresAt: now + 55 * 60 * 1000,
  };
  return cachedAuthToken.value;
}

async function createSubscriptionCheckout({ config, plan, reference, redirectUrl, cancelUrl }) {
  const authToken = await getAuthToken(config);
  const params = new URLSearchParams({
    plan_id: plan.providerPlanId,
    auth_token: authToken,
    env: config.environment,
    redirect_url: redirectUrl,
    cancel_url: cancelUrl,
    reference,
  });
  return `${config.checkoutHost}/checkout/auth/login?${params.toString()}`;
}

function verifyWebhookSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !secret || !/^[a-f\d]{64}$/i.test(signature)) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function nextBillingPeriodStart(lastPeriodEnd, now = new Date()) {
  return lastPeriodEnd && lastPeriodEnd > now ? lastPeriodEnd : now;
}

function addOneCalendarMonth(date) {
  const next = new Date(date);
  const originalDay = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDayOfMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(originalDay, lastDayOfMonth));
  return next;
}

module.exports = {
  subscriptionPlans,
  validOrigin,
  getSafepayConfig,
  getSafepayConfigurationErrors,
  getPlanForTier,
  createSubscriptionCheckout,
  verifyWebhookSignature,
  nextBillingPeriodStart,
  addOneCalendarMonth,
};
