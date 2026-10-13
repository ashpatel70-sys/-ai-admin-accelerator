# AI Admin Accelerator — production launch checklist

## Current staging state (13 October 2026)
- **Staging web service:** https://ai-admin-accelerator-shop.onrender.com
- **Render service ID:** `srv-db6rq46k1f9s73bapl1g` in My Workspace.
- **GitHub source:** `ashpatel70-sys/-ai-admin-accelerator` (currently PUBLIC; no private product assets in it).
- **Previous static preview:** https://ai-admin-accelerator-preview.onrender.com — non-commerce preview only.
- **Stripe account:** LinkedIn Stripe account; catalogue products created for toolkit £29 and workflow review £149.
- **Stripe webhook:** `we_1UPy0mDwwUKjI9bP1ty3CNfW`, currently DISABLED while fulfilment is incomplete. Only new-store checkout events should trigger fulfilment; handler checks store metadata.
- **Hosted checkout:** DISABLED. The storefront is not yet accepting payments.
- **Tests:** 10 automated tests pass at Render build (staging safety, no public toolkit, unsigned webhook cannot process).

## Before accepting a first payment
1. **Use a private GitHub repository for any sensitive code or commercially licensed content.** Never commit API keys or customer data. The digital ZIP must not be added to this public repository.
2. **Identify the seller:** enter the correct legal entity/trading name, geographic address, actual support email, registered company and VAT details if applicable. Replace every placeholder in `public/terms.html` and `public/privacy.html` and get suitable UK consumer, privacy and tax review.
3. **Email:** connect a Resend account, verify the sender domain, and set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OWNER_EMAIL` and `PUBLIC_CONTACT_EMAIL` as private Render variables. Do not paste API keys into chat.
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
