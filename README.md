# HamsafarHub

HamsafarHub is a matrimonial workspace for professional matchmakers, with a React frontend and a Node/Express/PostgreSQL API.

## Project layout

- `frontend/` — React, Vite, Tailwind CSS, and the API-connected workspace.
- `backend/` — Express API, Prisma schema/migrations, payment adapter, and tests.
- `backend/.env` — local-only database, JWT, admin, and payment credentials. This file is ignored by Git.

The root `package.json` defines npm workspaces and a single root `package-lock.json`; install dependencies from the project root.

## Local setup

Requirements: Node.js 20+ and PostgreSQL 17 or compatible.

1. From the project root, install both workspace dependency sets:

   ```powershell
   npm.cmd install
   ```

2. Configure `backend/.env` from `backend/.env.example`. Set `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (12-72 UTF-8 bytes).
3. Generate Prisma Client, apply migrations, and seed the initial administrator:

   ```powershell
   npm.cmd run db:generate
   npm.cmd run db:deploy
   npm.cmd run db:seed
   ```

4. In separate terminals from the root, start the API and frontend:

   ```powershell
   npm.cmd run dev:backend
   npm.cmd run dev:frontend
   ```

   Open the Vite URL (normally `http://localhost:5173`). The dev server forwards `/api` to `http://localhost:3000`. The backend health endpoint is `http://localhost:3000/health`.

Useful root commands: `npm.cmd run build`, `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run db:studio`, and `npm.cmd run db:migrate -- --name describe_change` (for local development). Backend API tests mock the database and need no test database. The `.cmd` form works in PowerShell when the execution policy blocks the `npm.ps1` shim; run these commands from the project root.

## App access rules

- Matchmaker accounts are created by `POST /api/auth/register`. The frontend then signs in through the API; passwords are never stored in browser storage.
- Consultant signup requires a phone number, which administrators can see alongside each client's profile and uploading consultant.
- Consultants must be at least 18 and provide their date of birth during signup. Client profiles require a date of birth for the same minimum age eligibility; the form displays the calculated age.
- Every new client profile requires a JPEG, PNG, or WebP photo (maximum 3 MB); consultants can update their profiles and replace photos. Photos appear on profile cards and details throughout the workspace and are served through authenticated, profile-scoped access for owners, administrators, match-result viewers, and coordination participants.
- Consultants can contact administrator Shagufta Durani from the Help page by phone or WhatsApp.
- The legal pages identify HamsafarHub's operator as Shagufta Durani and provide phone/WhatsApp contact links.
- Consultant signup also requires acceptance of the Terms and Conditions (`/terms`) and Privacy Policy (`/privacy`); the accepted legal version and timestamp are recorded. Consultants must have the client's permission before uploading their photo.
- For local page testing only, `SUBSCRIPTION_TEST_MODE=true` in development enables free package access while retaining administrator approval. Set it to `false` and restart the backend to restore Safepay checkout. This mode is ignored outside `NODE_ENV=development`.
- A subscription is activated only after a signed Safepay subscription webhook confirms a successful payment. Redirects from the hosted checkout never grant access.
- Administrator approval is separate from subscription payment. Matchmaker tools remain locked until both the subscription and account approval requirements are met.
- Historical one-time package payments do not count as recurring subscriptions; existing matchmakers need an active subscription for access.
- The Normal package permits Pakistan-based profiles only. Golden permits local and international profiles.
- Profile contact information is returned only to its owning matchmaker/admin, or after the target profile's matchmaker approves a coordination request.
- Consultants can run matching for their own source profiles against eligible profiles uploaded by Normal-plan consultants; Golden-plan consultants' profiles are not included in candidate results, while Golden-plan users can match with compatible Normal-plan profiles. Results include opposite-gender profiles with a score and unmet-criteria indicators; only profiles with reciprocal structured age, city, education, caste, and height preferences satisfied, the 8/10 Marla rule met, and a score of at least 85% are marked compatible and offered for coordination requests. Numeric age/height preferences score by closeness, categorical mismatches score zero, and any failed criterion caps the overall score at 84%. Profiles without structured preferences receive 0% and are marked as not scoreable for compatibility. Consultants can open a result to view the client's complete non-contact profile, photograph, and the uploading consultant's name and phone number; client phone/email remain hidden unless coordination is approved. Normal-plan matching remains limited to Pakistan-based profiles. Results are ranked by score; free-text requirements are not automatically interpreted.

## Safepay monthly subscriptions

The backend uses Safepay's hosted subscription checkout (PKR, sandbox by default). Matchmakers can select any payment method Safepay enables for the merchant account; confirm supported Pakistani cards and wallets with Safepay. HamsafarHub does not collect or store payment credentials.

The monthly prices are Normal PKR 10,000 and Golden PKR 15,000. Safepay plan IDs are configured server-side and the application derives the tier and amount from its own plan configuration, not browser-supplied amounts.

Set these server-side values in `backend/.env` using credentials and plan IDs issued for the same Safepay environment:

```dotenv
SAFEPAY_ENV=sandbox
SAFEPAY_HOST=https://sandbox.api.getsafepay.com
SAFEPAY_CHECKOUT_HOST=https://sandbox.api.getsafepay.com
SAFEPAY_SECRET_KEY=your_sandbox_merchant_secret
SAFEPAY_WEBHOOK_SECRET=your_sandbox_webhook_signing_secret
SAFEPAY_NORMAL_MONTHLY_PLAN_ID=plan_your_normal_monthly_sandbox_id
SAFEPAY_GOLDEN_PLAN_ID=plan_your_golden_sandbox_id
APP_URL=http://localhost:5173
SAFEPAY_WEBHOOK_URL=https://your-public-tunnel.example/api/subscriptions/safepay/webhook
SUBSCRIPTION_GRACE_DAYS=3
```

Configure Safepay's dashboard to POST subscription events to the exact `SAFEPAY_WEBHOOK_URL` above and use the matching webhook signing secret. The API must be reachable over public HTTPS; for local development, run an HTTPS tunnel to port 3000 and put its full webhook URL in `SAFEPAY_WEBHOOK_URL`. Set the Safepay redirect URL to the frontend's `/payment/result` page if the dashboard requires one; the backend supplies its own checkout return and cancel URLs. `FRONTEND_ORIGIN` remains the browser's allowed origin and can stay `http://localhost:5173` during local testing.

Generate Prisma Client and apply pending migrations from the project root before starting the backend:

```powershell
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run payments:check
```

Set `SUBSCRIPTION_TEST_MODE=false`, restart the backend, and confirm `GET http://localhost:3000/api/subscriptions/plans` reports `"provider":"SAFEPAY"` and no `checkoutUnavailableReason`. Sign in as a matchmaker and use the subscription checkout; test successful, failed, and cancelled subscription events in Safepay sandbox. `payments:check` checks configuration format only; it does not contact Safepay or prove that credentials, plans, webhook delivery, or payment methods work. Old one-time checkout endpoints are no longer used.

Use `SAFEPAY_ENV=production` only with production API/checkout hosts, merchant secret, webhook secret, and production plan IDs. Production requires an HTTPS `APP_URL` and a public HTTPS webhook endpoint.

## Production checklist

- Use HTTPS, strong managed secrets, and production Safepay credentials.
- Set `APP_URL`, `SAFEPAY_WEBHOOK_URL`, `FRONTEND_ORIGIN`, and `VITE_API_URL` for the deployed environment.
- Back up PostgreSQL, monitor webhook processing failures, and configure Safepay's production subscription webhook.
- Review retention and access policy for sensitive matrimonial profile data before collecting real customer records.
