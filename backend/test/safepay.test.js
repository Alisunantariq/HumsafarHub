const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  subscriptionPlans,
  getSafepayConfigurationErrors,
  getPlanForTier,
  createSubscriptionCheckout,
  verifyWebhookSignature,
  addOneCalendarMonth,
} = require("../src/services/safepay");

test("monthly plan prices and configured plan IDs are selected server-side", () => {
  assert.equal(subscriptionPlans.normal.amountPkr, 10000);
  assert.equal(subscriptionPlans.golden.amountPkr, 15000);
  assert.equal(getPlanForTier("normal"), null);
  assert.equal(getPlanForTier("golden"), null);

  process.env.SAFEPAY_NORMAL_PLAN_ID = "plan_test-normal";
  process.env.SAFEPAY_GOLDEN_PLAN_ID = "plan_test-golden";
  assert.equal(getPlanForTier("normal").providerPlanId, "plan_test-normal");
  assert.equal(getPlanForTier("golden").providerPlanId, "plan_test-golden");
  delete process.env.SAFEPAY_NORMAL_PLAN_ID;
  delete process.env.SAFEPAY_GOLDEN_PLAN_ID;
});

test("requires environment-matched credentials, plans, and webhook URL", () => {
  const validEnvironment = {
    SAFEPAY_ENV: "sandbox",
    SAFEPAY_HOST: "https://sandbox.api.getsafepay.com",
    SAFEPAY_CHECKOUT_HOST: "https://sandbox.api.getsafepay.com",
    SAFEPAY_SECRET_KEY: "test-secret",
    SAFEPAY_WEBHOOK_SECRET: "test-hmac-secret",
    SAFEPAY_NORMAL_PLAN_ID: "plan_normal",
    SAFEPAY_GOLDEN_PLAN_ID: "plan_golden",
    APP_URL: "http://localhost:5173",
    SAFEPAY_WEBHOOK_URL: "https://dev-tunnel.example.ngrok.app/api/subscriptions/safepay/webhook",
    SUBSCRIPTION_GRACE_DAYS: "3",
  };
  assert.deepEqual(getSafepayConfigurationErrors(validEnvironment), []);
  assert.match(
    getSafepayConfigurationErrors({
      ...validEnvironment,
      SAFEPAY_WEBHOOK_URL: "http://localhost:3000/api/subscriptions/safepay/webhook",
    }).join(" "),
    /public HTTPS URL/,
  );
  assert.match(
    getSafepayConfigurationErrors({
      ...validEnvironment,
      SAFEPAY_HOST: "https://api.getsafepay.com",
    }).join(" "),
    /must be https:\/\/sandbox\.api\.getsafepay\.com/,
  );
  assert.match(
    getSafepayConfigurationErrors({
      ...validEnvironment,
      SAFEPAY_SECRET_KEY: "your_sandbox_secret_key",
    }).join(" "),
    /SAFEPAY_SECRET_KEY is missing/,
  );
});

test("builds Safepay's documented subscription checkout URL after server token issuance", async (t) => {
  const originalFetch = global.fetch;
  const originalEnvironment = {
    SAFEPAY_NORMAL_PLAN_ID: process.env.SAFEPAY_NORMAL_PLAN_ID,
    SAFEPAY_GOLDEN_PLAN_ID: process.env.SAFEPAY_GOLDEN_PLAN_ID,
  };
  process.env.SAFEPAY_NORMAL_PLAN_ID = "plan_normal-sandbox";
  process.env.SAFEPAY_GOLDEN_PLAN_ID = "plan_golden-sandbox";
  t.after(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  let authRequest;
  global.fetch = async (url, options) => {
    authRequest = { url, options };
    return { ok: true, json: async () => ({ data: "short-lived-server-token" }) };
  };

  const config = {
    environment: "sandbox",
    host: "https://sandbox.api.getsafepay.com",
    checkoutHost: "https://sandbox.api.getsafepay.com",
    secretKey: "test-secret",
    webhookSecret: "test-webhook-secret",
    appUrl: "http://localhost:5173",
  };
  const checkoutUrl = await createSubscriptionCheckout({
    config,
    plan: getPlanForTier("golden"),
    reference: "subref_internal-correlation-id",
    redirectUrl: "http://localhost:5173/payment/result?reference=subref_internal-correlation-id",
    cancelUrl: "http://localhost:5173/payment/result?reference=subref_internal-correlation-id&status=cancelled",
  });

  assert.equal(authRequest.url, "https://sandbox.api.getsafepay.com/client/passport/v1/token");
  assert.equal(authRequest.options.method, "POST");
  assert.equal(authRequest.options.headers["X-SFPY-MERCHANT-SECRET"], config.secretKey);
  assert.equal(authRequest.options.body, "{}");
  const url = new URL(checkoutUrl);
  assert.equal(url.origin, config.checkoutHost);
  assert.equal(url.pathname, "/checkout/auth/login");
  assert.equal(url.searchParams.get("plan_id"), "plan_golden-sandbox");
  assert.equal(url.searchParams.get("auth_token"), "short-lived-server-token");
  assert.equal(url.searchParams.get("env"), "sandbox");
  assert.equal(url.searchParams.get("reference"), "subref_internal-correlation-id");
});

test("verifies Safepay HMAC signatures against the unmodified raw body", () => {
  const rawBody = Buffer.from('{"id":"evt_test","type":"subscription.created","data":{}}');
  const secret = "sandbox-hmac-secret";
  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  assert.equal(verifyWebhookSignature(rawBody, signature, secret), true);
  assert.equal(verifyWebhookSignature(Buffer.from(`${rawBody.toString()} `), signature, secret), false);
  assert.equal(verifyWebhookSignature(rawBody, "bad-signature", secret), false);
  assert.equal(verifyWebhookSignature(Buffer.from(rawBody.toString()), signature, ""), false);
});

test("monthly billing period calculation handles short months", () => {
  const jan31 = new Date("2026-01-31T12:00:00.000Z");
  assert.equal(addOneCalendarMonth(jan31).toISOString(), "2026-02-28T12:00:00.000Z");
});
