# Domain-free staging plan (13 October 2026)

## Website
- Keep using **https://ai-admin-accelerator-shop.onrender.com**. This address is already deployed and does not need a separately purchased domain.
- The present code is a staging-only shop, not an operating e-commerce checkout. Keep `LIVE_SALES_ENABLED=false`, `LEGAL_READY=false` and `FULFILMENT_TESTED=false`.
- The seller can evaluate copy, responsive design, rates and the order preview without taking customer payments.
- Keep `public/robots.txt` and `noindex` until formal launch.

## Resend / transactional email
- On 13 October 2026, the connected Resend account has **no verified sending domains**.
- **AgentMail business contact:** `aiadminaccelerator@agentmail.to`, display name AI Admin Accelerator. Verified by sending a self-addressed test email and confirming receipt. This is separate from the website's inactive Resend fulfilment integration.
- This address can be shown on the public website; the personal Gmail remains private.
- Resend's `onboarding@resend.dev` sender is for testing and not a production route for emailing arbitrary paying customers. Do not attempt to send production transactional mail from `onrender.com`; the owner cannot add email DNS records for the shared hosting subdomain.
- Do not invent a verified domain or use a third party's sender identity.
- For integration development, test the email templates with permitted test recipients; do not send real paid order emails yet.
- Later: register an affordable custom domain chosen by the owner, configure DNS SPF/DKIM per Resend, verify it in the Resend dashboard, then set `RESEND_FROM_EMAIL`, `RESEND_API_KEY` and other contact/email variables privately in Render.

## Other launch blockers
- Seller's legal/trading name and geographic contact address remain outstanding. Public customer support is `aiadminaccelerator@agentmail.to`.
- Draft terms and privacy notices still contain placeholders.
- Stripe server secret and webhook signing secret are absent from the deployed service. The live webhook endpoint remains disabled.
- Private secure toolkit storage and completed sandbox purchase-to-delivery test are outstanding.
- The £149 personalised service requires a reliable way to communicate with the buyer and deliver written work.
- Before any real purchases, validate statutory pre-contract information and durable confirmation, and review cancellation handling under UK law.

## Launch decision
**No domain purchase is required for the staging website.** For a production storefront that automatically emails buyers, a verified sender domain (or another demonstrably reliable and legally compliant customer-communication process) remains an outstanding launch dependency. No purchase is authorised by this plan. Keep customer payment checkout disabled until operational requirements and end-to-end tests pass.
