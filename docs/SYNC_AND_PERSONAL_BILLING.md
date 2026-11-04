# Device synchronization and personal billing

Changes ship together to `main` through the existing Vercel Git integration.

## Record preservation and deployment

Before applying the Realtime publication and personal subscription migrations, checkpoint the current private snapshots in the existing owner-scoped `private_snapshot_history` table with their current revision, and verify payload hashes match. Abort on a mismatching existing history revision. This bounded checkpoint avoids duplicating Auth credentials or every public table. Record counts and digests cover Auth identities and court membership without exporting sensitive values. Snapshot history is an in-project recovery copy, not a replacement for independent disaster recovery backups. Restore only through an owner-reviewed transaction, scoped to the affected account, after checking newer revisions. Never restore over later user edits wholesale.

The Realtime migration only publishes private snapshot INSERT/UPDATE events. Existing owner RLS remains enforced. Billing adds restrictive entitlement policies; it does not replace owner policies or rewrite private records. Independent personal accounts and active court sponsorship retain access. Suspensions cannot be bypassed by subscribing.

Old releases banned removed users. The additive migration queues those existing removals, and the Node production startup hook uses the Supabase Auth Admin API to unban them once. Jobs are claimed with a lease and record completion. Later suspended users are skipped. New removals already unban Auth before changing sponsorship. No identity or private record is deleted.

Verify backup hashes and private record counts before and after each migration. Any ordinary user edits during release must appear at a newer revision with the original preserved in `private_snapshot_history`.

## Synchronization

The encrypted device snapshot includes its acknowledged cloud base. Each save uses a compare-and-swap revision. Realtime, foreground/focus/online events and a 15-second visible reconciliation refresh pull newer records. The engine three-way merges independent additions, edits and deletions; it never selects a winner by device clock. Same-field conflicts retain an encrypted append-only device recovery copy and require a choice. Choosing cloud values only replaces conflicting values; independent device changes still merge.

Legacy unsynced device copies recover their original base from owner-scoped history. If that revision is unavailable, the app preserves a recovery copy before offering explicit cloud/device choices. Device sign-out first awaits encrypted saving, and signs out only the local session. An unfinished form still needs saving or dismissal. Clearing browser site data can remove the device key and unsynced copy.

Remote revisions clear whole-workspace undo history to avoid reverting another device's work. Cloud refreshes do not remount draft forms. Recovery export downloads private unencrypted data only after confirmation.

## Billing

Live Stripe account: Global Intent Company (`acct_1UO1Tb0ULZCgUuKW`).

- Product: `daybridge_personal`
- Price: `price_1UXrPz0ULZCgUuKWZXQE9LPb` — USD 399 cents, monthly
- Portal configuration: `bpc_1UXrS10ULZCgUuKWjnwBaDKV`
- Webhook: `we_1UXrR10ULZCgUuKWrgmGNhZN`, `/api/billing/webhook`, API `2026-09-30.endive`

Server-only Vercel Production configuration: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are Sensitive variables; `STRIPE_PRICE_ID`, `STRIPE_PORTAL_CONFIGURATION_ID`, and `DAYBRIDGE_PUBLIC_URL` select the fixed plan and trusted return origin. Never prefix secrets with `NEXT_PUBLIC_`. Use a restricted key: Customers, Checkout Sessions, Customer Portal, Subscriptions Write; Prices, Products, Invoices, Invoice Payments, Charges, Payment Intents Read. Rotate keys on staff departure, require passkeys/authenticator MFA for Stripe staff, and apply provider access policies where compatible with hosting egress.

Removal hides the participant from the court dashboard and frees a seat, retaining the participant registry for authorization and auditing. Auth remains usable. Only the removed user can choose the personal subscription at sign-in. Existing court sponsorship is never automatically charged. If sponsorship is restored while a personal subscription exists, settings exposes the portal with an overlap notice; the user can cancel the personal subscription there.

Checkout is authenticated, same-origin, rate limited, fixed-price and customer-bound. Database reservations plus Stripe idempotency keys reuse checkout sessions and prevent repeated-click subscriptions. An existing incomplete/past-due subscription goes to its portal rather than creating another. Internal sign-in email aliases and private schedules/medical/court details are never sent to Stripe; Stripe Checkout collects a real billing email.

Success redirects do not grant access. Signed raw-body webhooks reconcile current Stripe subscription and paid invoice state. An active status without a paid period gives no access. A failed renewal retains only an already-paid period. Portal cancellation takes effect at period end. Webhook receipts are idempotent; monotonic refresh tokens reject stale concurrent results. Events for other merchant products/customers are ignored. Refund, dispute and early fraud warning events follow the Endive PaymentIntent → InvoicePayment → Invoice → Subscription graph. Partial refunds are recorded; full refunds/disputes/fraud warnings block the affected personal subscription and schedule renewal cancellation. Review risk receipts in `daybridge_billing_risks`; resolve through an owner-reviewed support process after reviewing Stripe's case, rather than deleting private user data.

The subscription gate always offers local sign-out, cloud export and encrypted device recovery export. Cloud export authenticates ownership server-side and never takes a client-supplied owner ID. Subscription cancellation and failed payments do not delete records.

No automatic tax is enabled: the merchant account had no active tax registrations at setup. Determine registration obligations and configure Stripe Tax before collecting tax. Vercel's current Hobby plan is for personal non-commercial use; use commercially permitted hosting before accepting subscriptions. No hosting plan was upgraded by this release.

## Validation boundaries

Unit, disposable PostgreSQL and local production browser tests use synthetic data to cover races, owner isolation, offline merges, conflict recovery, sign-out, court dashboard removal and subscription gating. They do not prove a live card payment or multi-device Realtime delivery. Production verification separately checks the deployed commit, live endpoint authorization, signed webhook rejection, database publication/RLS, catalog/portal/webhook configuration and record integrity. A real payment is completed only by the customer, in hosted Checkout.
