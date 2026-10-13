# Stripe Sandbox — AI Admin Accelerator (UK)

Updated 13 October 2026. The production shop remains CLOSED for real-money orders.

## Current connection
The connected Stripe account (displayed as **Linkedin**) is available only in **live mode** through the ChatGPT Stripe connector. The current tools do not offer a create-sandbox operation, and the local Stripe CLI is not installed and cannot access the package registry. Do not charge a real payment card to test.

## Create and connect a test sandbox
1. Sign in to [Stripe Dashboard](https://dashboard.stripe.com/).
2. In the account switcher, open **Sandboxes** and choose **Create sandbox**.
3. Name it **AI Admin Accelerator QA**, then select this sandbox rather than the live account.
4. In the sandbox catalogue, create the test equivalents of the products:
   - **AI Admin Toolkit** — one-time **GBP 29.00**.
   - **AI Workflow Review** — one-time **GBP 149.00**.
   - Keep the resulting `price_...` identifiers for this sandbox only; live price IDs are not interchangeable.
5. Under sandbox **Developers → API keys**, create a restricted key with the minimum Checkout Session, customer/session and line-item access this application needs. Never paste API keys into ChatGPT or GitHub.
6. Under sandbox **Developers → Webhooks**, create a separate endpoint for the sandbox web-service instance, subscribed to `checkout.session.completed` and `checkout.session.async_payment_succeeded`; save its sandbox signing secret privately.
7. Connect the sandbox to ChatGPT's Stripe app, if offered, so the assistant can provision/test the sandbox products without interacting with live money.

## Safe test architecture
Do not overwrite production Render's live price IDs with sandbox prices. Use an independent isolated staging Render web service with environment variables for sandbox Stripe keys, prices, webhook signing secret, and the already prepared AgentMail/ZIP settings. Keep production flags `LIVE_SALES_ENABLED=false`, `LEGAL_READY=false`, `FULFILMENT_TESTED=false`.

The existing 28 automated tests use local simulated Stripe and email APIs, and DO NOT prove a real Stripe sandbox purchase.

## Test evidence required
- Paid sandbox £29 toolkit: checkout, signed webhook, durable receipt email, authenticated download, archive validation.
- Paid sandbox £149 review: checkout, signed webhook, receipt, intake form, owner notification.
- Invalid signature and unpaid payment never release download.
- Duplicate webhooks and asynchronous success don't deliver repeatedly.
- Refund/cancellation handling documented and manually validated.
- Test email deliverability verified from the deployed app.

## Go-live legal gate
UK distance selling requires a correctly identified trader, an established geographic address, accurate information on digital-content cancellation and consumer rights, a durable contract confirmation, and a model cancellation form where relevant. Official references:
- https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling
- https://www.gov.uk/online-and-distance-selling-for-businesses/distance-selling
- https://www.legislation.gov.uk/uksi/2013/3134/contents

The shop now requires `PUBLIC_SELLER_LEGAL_NAME` and `PUBLIC_SELLER_POSTAL_ADDRESS` as additional readiness checks, but these variables have not been provided or published. Do not use an individual's residential address without clear consent.

Do not enable live Stripe checkout until all operational and legal checks are complete and the owner expressly approves launch.

## QA site provisioned, 13 October 2026
- Sandbox website: https://ai-admin-accelerator-qa.onrender.com
- Dashboard: https://dashboard.render.com/web/srv-db6t1n0n74is738ueg00
- Free Node/Render Frankfurt service using the public GitHub app source, `DEPLOYMENT_STAGE=qa`.
- API key format protection: QA rejects `sk_live_...` and `rk_live_...` Stripe keys even if every readiness setting is true. A legitimate sandbox restricted key `rk_test_...` or test secret `sk_test_...` can be used after separate environment configuration.
- Toolkit archive staged privately in QA Render `TOOLKIT_BASE64`; customer email sender credential is **not cloned** into QA automatically.
- Automated test suite: **30 passed, 0 failed**. The 5 mock payment lifecycle tests now execute in QA mode; live-key rejection has 2 tests.
- Live production store remains closed to payments. The QA store also remains closed until sandbox credentials and operational testing are deliberately configured.
- User created a sandbox in Stripe Dashboard, but it has not yet been made available in the connected Stripe app. Authorise it using ChatGPT's Stripe account-management link and then recheck the available accounts list before changing any Stripe resources.

## Sandbox is connected, product catalogue and event endpoint configured (13 October 2026)
- **Stripe connected sandbox:** `AI Admin Accelerator QA.`, Stripe account `acct_1UPzFCDZ2uwtomrM` (livemode `false`). Production account `acct_1RgJZgDwwUKjI9bP` remains untouched.
- **Test toolkit** product `prod_VQrAOR5qslgPyx`; price `price_1UPzSbDZ2uwtomrMbnbVLK5x` = GBP 29.00 one-time.
- **Test review** product `prod_VQrBlG4jnqmuYm`; price `price_1UPzSkDZ2uwtomrMm8kCkPl6` = GBP 149.00 one-time.
- **Sandbox webhook** `we_1UPzTnDZ2uwtomrMLemtecLS` (livemode false), destination `https://ai-admin-accelerator-qa.onrender.com/api/stripe-webhook`, subscribed to checkout completed, async payment succeeded and async payment failed. Stripe created a private signing secret, but the attempt to set it in Render failed due to a Render connector account-link error. Do not put the secret in a public file.
- **Stripe API verified** both prices and accepted one Stripe-hosted test Checkout Session for each product, with `livemode=false`, `payment_status=unpaid`; no customer card was charged and no webhook-driven fulfilment has happened.
- **GitHub stage handling**: `server.js` embeds the verified public sandbox **price IDs only when** `DEPLOYMENT_STAGE=qa`. The live shop still requires its own separate configured prices.
- **QA safety**: live Stripe keys cannot activate the QA store. Sandbox test emails have an unmistakable no-money label; QA web pages display a testing-only notice. The live production legal identity/address gate remains unchanged. For the QA sandbox only, actual trader legal identity isn't required, because simulated purchases are not real consumer transactions.
- **Render connector issue**: connected Render operations are currently returning `link_id must identify an eligible linked account` since the Stripe connector reauthorisation. Update the ChatGPT Render app connection before further infrastructure changes, or set the missing variables directly in the Render QA service as a one-off.
- **Still needed for true end-to-end sandbox testing**: securely configure `STRIPE_SECRET_KEY` with a key from the **QA Stripe sandbox** only, `STRIPE_WEBHOOK_SECRET` from the sandbox event endpoint, and `AGENTMAIL_API_KEY` from the business inbox in the **QA Render service only**. Do not copy live Stripe credentials into QA. `TOOLKIT_BASE64`, `DEPLOYMENT_STAGE=qa`, `OWNER_EMAIL` and `PUBLIC_BASE_URL` are already in the QA service. Then verify a sandbox purchase, webhook and protected download before using the QA test-only enablement gates. Do not enable the production shop.
- **Version-control automated tests**: GitHub workflow `.github/workflows/tests.yml` was installed and will run `npm test` on main changes.

## Connected Render sandbox webhook configuration — 13 October 2026
- Restored Render app access by selecting the authorized **Render** linked account explicitly (the prior generic connection failure was a missing account selector, not loss of the workspace).
- Verified sandbox account `acct_1UPzFCDZ2uwtomrM`, `livemode=false`.
- Created the **active** QA webhook `we_1UQ0EbDZ2uwtomrMfpcZr4VZ` for `https://ai-admin-accelerator-qa.onrender.com/api/stripe-webhook`, with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`.
- Sent the webhook signing secret **directly** to the QA Render environment as `STRIPE_WEBHOOK_SECRET`; it was **never written to this repository or shown to the owner in chat**.
- Disabled the superseded sandbox webhook `we_1UPzTnDZ2uwtomrMLemtecLS` to avoid duplicate events.
- Installed both verified sandbox price IDs into the QA Render environment, with `DEPLOYMENT_STAGE=qa` and **all three payment flags still false**.
- QA deployment `dep-db6u1vbrjlhs73993ceg` completed successfully; **30 tests passed** and app log confirms **checkout DISABLED**.
- Application log confirms **`AgentMail credential present=false`**, even though toolkit storage is valid. The QA Render service still needs a **separate AgentMail API key** (`AGENTMAIL_API_KEY`) and **sandbox-only restricted Stripe key** (`STRIPE_SECRET_KEY`). The production AgentMail key must not be exposed or moved through GitHub/chat, and a live Stripe key must never be used in QA.
- The two sandbox Stripe Checkout Sessions already created remain **unpaid**; no genuine end-to-end paid sandbox purchase yet.
- No changes were made to the production Stripe live account and production customer checkout remains disabled.
- After the owner privately adds the two remaining keys, verify QA readiness from `/api/health`, run a genuine sandbox card purchase, confirm Stripe webhook and buyer receipt, protected ZIP download, and the £149 review intake. Only sandbox QA payment flags may then be intentionally enabled; leave production flags false.
