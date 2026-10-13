# AI Admin Accelerator — production launch checklist

## Current staging state (13 October 2026)
- **Staging web service:** https://ai-admin-accelerator-shop.onrender.com
- **Render service ID:** `srv-db6rq46k1f9s73bapl1g` in My Workspace.
- **GitHub source:** `ashpatel70-sys/-ai-admin-accelerator` (currently PUBLIC; no private product assets in it).
- **Previous static preview:** https://ai-admin-accelerator-preview.onrender.com — non-commerce preview only.
- **Stripe account:** LinkedIn Stripe account; catalogue products created for toolkit £29 and workflow review £149.
- **Stripe webhook:** `we_1UPy0mDwwUKjI9bP1ty3CNfW`, currently DISABLED while fulfilment is incomplete. Only new-store checkout events should trigger fulfilment; handler checks store metadata.
- **Hosted checkout:** DISABLED. The storefront is not yet accepting payments.
- **Tests:** 25 automated tests pass at Render build on 13 October 2026, including simulated Stripe + AgentMail purchase, signed webhook, fulfilment and intake tests. No real Stripe sandbox purchase yet.

## Render deployment note
The service was created from a public Git URL rather than an authenticated provider integration. Render requires a manual deployment after new code commits in this setup, even when the service reports an automatic deployment setting. Recheck that the intended commit SHA is live after each code update. Do not enable sales based solely on GitHub commits.

## Before accepting a first payment
1. **Use a private GitHub repository for any sensitive code or commercially licensed content.** Never commit API keys or customer data. The digital ZIP must not be added to this public repository.
2. **Identify the seller:** enter the correct legal entity/trading name, geographic address, actual support email, registered company and VAT details if applicable. Replace every placeholder in `public/terms.html` and `public/privacy.html` and get suitable UK consumer, privacy and tax review.
3. **Email:** the AgentMail inbox `aiadminaccelerator@agentmail.to` is active and publicly listed. The website's Resend transactional emails are NOT connected. Verify a sender domain, then set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OWNER_EMAIL` and `PUBLIC_CONTACT_EMAIL` as private Render variables. Do not paste API keys into chat.
4. **Digital delivery:** use private protected storage, or for this small ZIP temporarily configure `TOOLKIT_BASE64` as a private Render environment variable. Do not publish the ZIP in GitHub. Test receiving, unzipping and using the product.
5. **Stripe:** configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Render private environment variables; production webhooks should be enabled only after the handler accepts and verifies signed events and sends emails. The existing Stripe live webhook is disabled; review and enable it when ready. Never paste secrets into chat.
6. **Test environment:** create sandbox-mode Stripe prices and keys; validate the full checkout > webhook > delivery email > purchase verification > download/owner intake lifecycle with test payments, including a failed/delayed payment. The live account's price IDs cannot be used with a test-mode key.
7. **Reliability:** the Render free web-service plan can sleep. Before running paid commerce, select a suitable reliable hosting plan and monitoring on explicit approval of any charges, then test webhook delivery/retries and error handling.
8. **Only after all the above:** set `LEGAL_READY=true`, `FULFILMENT_TESTED=true` and `LIVE_SALES_ENABLED=true` in Render. The server enables checkout only when all required configuration fields are present as well.

## Implementation notes
- `/api/health` and `/api/config` expose only readiness, never secrets.
- `/api/checkout` creates Stripe-hosted sessions with server-selected prices, not user-supplied amounts.
- `/api/stripe-webhook` verifies the Stripe HMAC signature before fetching the paid order.
- `/api/order`, `/api/download`, and `/api/intake` re-check payment and product identity with Stripe.
- Buyer emails link to a verified order page; review intake is sent privately to owner.
- This code is a **starter implementation**. Complete compliance, reliability and end-to-end integration testing before opening sales.

## Dedicated business inbox (13 October 2026)
- `aiadminaccelerator@agentmail.to` was created in AgentMail and a self-addressed send/receive test passed.
- The contact details are included in the website and legal-page drafts.
- Payment notification and fulfilment emails are not yet configured or end-to-end tested.

## 13 October 2026 integration update
- Verified full local mock-payment/email lifecycle with 25 passing tests; **not a real Stripe sandbox test**.
- Added optional AgentMail automatic receipt sending to server.js; needs an inbox-scoped private API key in Render.
- Validated the 13-file/45-prompt original customer toolkit and prepared its base64-encoded environment value for secure transfer to Render without making it public in GitHub.
- Real payments intentionally remain disabled until secure credentials, seller identity/policies and real sandbox fulfilment tests are completed.

## Private toolkit deployment — 13 October 2026
- The full customer toolkit was installed in the Render shop service using the private `TOOLKIT_BASE64` environment variable; this value is NOT in GitHub.
- Render deployment `dep-db6seh0m7kps73b6p6d0` reached status `live` after the environment change.
- Build log: 25 tests passed and 0 failed; startup reports `checkout DISABLED`.
- Remaining email secret: `AGENTMAIL_API_KEY` has not been created by the connected AgentMail ChatGPT connector; its available operations provide email/inbox access but not account API-key issuance. The account owner must create an appropriately restricted key in the AgentMail Console and save it straight into Render (never GitHub).
- The Stripe live webhook is disabled and real-money checkout must remain off pending a genuine Stripe sandbox integration test, fulfilment verification, and seller/legal completion.

## AgentMail hosted connection verified (13 October 2026)
- Owner configured `AGENTMAIL_API_KEY` securely in Render.
- Render launch diagnostics confirmed `AgentMail credential present=true`, `email transport configured=true` and `valid paid toolkit present=true`.
- The Render-hosted shop successfully sent a non-customer test message from `aiadminaccelerator@agentmail.to` to itself using the real AgentMail API; the same message was verified as received in the AgentMail inbox.
- `AGENTMAIL_CONNECTIVITY_CHECK_ON_STARTUP` was then reset to `false` to prevent repeat test messages.
- Merchant payments remain disabled by `LIVE_SALES_ENABLED=false`, `LEGAL_READY=false` and `FULFILMENT_TESTED=false`.
- Outstanding: real Stripe sandbox setup, signed webhook + genuine sandbox purchase test, final seller legal details, UK consumer terms/privacy review, production reliability and explicit release approval.
