# AI Admin Accelerator — AgentMail and Stripe checkout integration

Updated 13 October 2026. The online store is intentionally **not taking payments**.

## Verified business email
- Inbox: `aiadminaccelerator@agentmail.to` (display name **AI Admin Accelerator**).
- Sending and receiving were tested using a self-addressed email.
- This is the public business contact and can be used without buying a custom domain.

## Website application
- Source: `server.js`.
- `sendMail()` chooses AgentMail when a private `AGENTMAIL_API_KEY` is configured, otherwise it uses the previously supported Resend provider.
- AgentMail API: `POST https://api.agentmail.to/v0/inboxes/:inbox_id/messages/send` with Bearer authentication.
- Domain-free AgentMail does not imply the hosted server has an API key: the AgentMail ChatGPT plugin connection is not the same as an API key configured in Render.
- The personalised service takes the buyer to a payment-verified intake page and emails the operator when the intake is submitted. Digital delivery is restricted to a verified paid toolkit order.

## Secrets to configure ONLY in Render
Go to https://dashboard.render.com/web/srv-db6rq46k1f9s73bapl1g -> Environment:

| Variable | Value / action |
|---|---|
| `AGENTMAIL_INBOX` | `aiadminaccelerator@agentmail.to` |
| `AGENTMAIL_API_KEY` | Create an **inbox-scoped sending key** in https://console.agentmail.to and paste it directly into Render as a secret. Do not put it in GitHub or chat. |
| `OWNER_EMAIL` | `aiadminaccelerator@agentmail.to` (already configured) |
| `PUBLIC_CONTACT_EMAIL` | `aiadminaccelerator@agentmail.to` (already configured) |
| `STRIPE_SECRET_KEY` | A **restricted key** issued specifically for this website and the correct Stripe environment. Separate sandbox and live keys. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this store's Stripe webhook endpoint in the matching environment. |
| `STRIPE_PRICE_TOOLKIT` | Correct GBP price ID from the matching environment (live IDs currently configured). |
| `STRIPE_PRICE_REVIEW` | Correct GBP price ID from the matching environment (live IDs currently configured). |
| `TOOLKIT_BASE64` | Base64-encoded *complete* `AI_Admin_Accelerator_Toolkit.zip` saved as a Render secret environment value; never put paid assets into this public repository. |
| `PUBLIC_BASE_URL` | `https://ai-admin-accelerator-shop.onrender.com` |

The published code will keep checkout off unless **all** these operational inputs are present and the following three flags are explicitly true: `LIVE_SALES_ENABLED`, `LEGAL_READY`, and `FULFILMENT_TESTED`. They are currently set to `false`. Do not set them true before the requirements and live release approval.

## Required full integration tests
1. Create a separate Stripe sandbox, with GBP £29 and £149 prices, separate restricted API key and matching signed webhook endpoint. Never charge a real card to test.
2. Set the sandbox variables, verify AgentMail can email a permitted test recipient, and verify that checkout offers the correct sandbox prices.
3. Test successful toolkit purchase, verified order URL, protected download and archive integrity; test unpaid session download denial.
4. Test personalised service purchase, buyer email, intake and owner notification. Test duplicate webhooks and failed/delayed payments.
5. Confirm the webhook is reachable and retry handling works. Check delivery reporting, refunds and customer contact details.
6. Before taking real money, complete **seller legal identity, postal contact address, consumer terms and privacy policy**. Resolve VAT/tax treatment.
7. Choose reliable hosting; Render free tier may sleep and is not recommended for time-sensitive payment webhooks.
8. Only after approval and test evidence: install live restricted Stripe credentials and signing secret; activate Stripe webhook; then deliberately enable checkout.

## Current limitations
- AgentMail inbox is live, but the Render web server **does not yet have an API key**.
- Paid ZIP exists in the owner's generated project files but **has not been added to Render private storage**.
- The connected Stripe tooling exposes the merchant's live account, not a test sandbox. No real charges were made.
- **25 automated tests passed** on the staging Render deployment, including 5 locally simulated checkout-to-fulfilment tests. Those simulations DO NOT constitute a live Stripe sandbox test.
- The owner product ZIP was validated: 13 packaged files, 45 AI prompt records, SHA-256 `225dcaf30b6cc2d884d724768b3782d2209c12a3b85bb86eeaa32d6197b41f4f`. A base64 text representation was prepared privately for secure Render `TOOLKIT_BASE64` entry.
- Buyer email receipts, ZIP delivery, and full checkout are therefore not yet end-to-end tested.

For operational help, contact `aiadminaccelerator@agentmail.to`. No personal email account is published.

## Private toolkit deployment — 13 October 2026
- The full customer toolkit was installed in the Render shop service using the private `TOOLKIT_BASE64` environment variable; this value is NOT in GitHub.
- Render deployment `dep-db6seh0m7kps73b6p6d0` reached status `live` after the environment change.
- Build log: 25 tests passed and 0 failed; startup reports `checkout DISABLED`.
- Remaining email secret: `AGENTMAIL_API_KEY` has not been created by the connected AgentMail ChatGPT connector; its available operations provide email/inbox access but not account API-key issuance. The account owner must create an appropriately restricted key in the AgentMail Console and save it straight into Render (never GitHub).
- The Stripe live webhook is disabled and real-money checkout must remain off pending a genuine Stripe sandbox integration test, fulfilment verification, and seller/legal completion.
