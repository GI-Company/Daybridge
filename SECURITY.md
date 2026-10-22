# DayBridge security model

## Current controls
- No public sign-up interface in the PWA. **Also turn off public sign-ups in Supabase dashboard**; UI alone is not enforcement.
- Authenticated Supabase account required before mounting any private views.
- Records stored under `private_snapshots.user_id`, protected by select/insert/update/delete owner-specific RLS; anonymous access revoked.
- All 17 domain tables have RLS owner predicates. The existing `rls_auto_enable()` privileged helper was revoked from public API roles.
- Public/publishable Supabase keys are safe in client code only with correct RLS. **Never** use a service role/secret key in `NEXT_PUBLIC_` variables.
- No plaintext app-data localStorage writes in the live data store.
- Service worker performs push display only, caches neither routes nor private data.
- Notifications use generic text to avoid exposing medication or court information on a lock screen.
- Password or passkey sign-in can persist session across launches. Device locking and revoking lost sessions remain the owner's responsibility.
- Headers disable framing, sniffing, referrals, and unneeded device capabilities.

## Unfinished / must verify before daily use
- Owner invitation and disabling sign-ups must be done in dashboard.
- Passkeys must be enabled for the final HTTPS relying-party domain (Supabase experimental feature).
- Scheduled notification dispatch, dedupe, retry, and delivery monitoring not yet implemented; never depend exclusively on app alerts for critical medication.
- Offline encrypted queue, automatic cross-device conflict resolution, session-step-up lock, key management for field encryption, and RLS impersonation/integration tests remain open.
- JSON download is unencrypted: protect or delete it after use.
- Do not include personal records in issue reports, screenshots, telemetry, or GitHub commits.
- HIPAA applicability depends on how the product is used and by whom; don't advertise certification.
