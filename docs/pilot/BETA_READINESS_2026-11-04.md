# Free 25-user beta: security audit and engineering readiness

Assessment: November 4, 2026. Scope: a voluntary, free beta for about 25 people using DayBridge beyond its owner's account. This is the current engineering assessment; the October institutional/regulated pilot documents are historical. This review does not enroll users, start payments, certify compliance, or replace real-device acceptance.

## Findings and fixes

| Finding | Impact | Resolution |
| --- | --- | --- |
| RLS-hidden snapshot interpreted as an empty workspace | Suspension or credential reset could reconcile private records away from the local view | Verify current workspace access before accepting a missing cloud row; errors preserve the encrypted device copy |
| First-use password requirement enforced primarily by the UI | An existing JWT could access snapshots before setup or after staff reset | Current server-owned Auth metadata is checked by database authorization; pending setup also blocks the server export endpoint |
| Background workers bypass user RLS | Suspended, unassigned, unpaid removed, or setup-pending accounts could still generate background notifications | Service-only reminder projection applies the same current entitlement; remaining browser-accessible travel/device tables receive restrictive entitlement policies |
| Removed → suspended seat transition missed capacity check | A full 25-seat court could exceed its seat limit | All transitions that reclaim a seat check capacity under the court-row lock; assignment/restore also check current subscription state in that transaction |
| Repeated full-snapshot transfers and serial worker operations | Unnecessary egress and a slow provider delaying other users | Unchanged browser polls fetch revision only; both pipelines share a request-local authorized projection; background processing uses four concurrent tasks per pipeline |
| Development dependency advisory | ESLint parser's minimatch dependency had a moderate denial-of-service advisory | Scoped override pins minimatch 11.0.1; production and complete npm audits report zero known vulnerabilities |
| Stale release documentation and clipped map-test clicks | Old candidate instructions misrepresented production; browser test could click empty map area | Current beta report is linked from README and historical reports; map selection targets the actual canvas center |

The dependency finding is [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Only the affected development dependency is overridden; application frameworks/providers are unchanged.

## Automated evidence

Run on Node.js 24, matching production:

- 131 unit tests pass, including cloud-read denial, conditional snapshot polling, per-account cache separation and bounded 25-account worker processing.
- Five disposable PostgreSQL tests across four suites pass: migration/data protections, owner RLS/CAS, cross-court access, billing isolation and the new 25-account scenario.
- The 25-account scenario fills every seat, rejects the 26th, proves suspension keeps a seat, exercises removal/restoration, denies capacity bypass and inactive-subscription restoration, saves/reads isolated records for each account, denies cross-account worker RPC use, and verifies pending setup/suspension blocks background records. It retains all 25 snapshots and 27 fixture Auth identities.
- Local type checking, lint, focused secret scan and production build pass. All 60 desktop/mobile browser checks pass. Browser verification covers desktop/mobile admin operations, offline/sync/account switching, lock/update protection, notification destinations, and the interactive map.

These PostgreSQL and browser tests use disposable/simulated services. They are **not hosted 25-user load tests**, real mobile installations, or evidence of push display on 25 physical devices. The measured local account saves/reads are functional evidence only.

## Hosted observations

- Supabase project is active/healthy; PostgreSQL 17.11.0.003. All 38 public tables have RLS enabled. Administrative/billing registries have no browser grants; their no-policy advisor notices reflect intentional service-only access.
- Public Auth settings verify `disable_signup=true` and anonymous users disabled. Existing accounts and staff assignments are preserved.
- Current courts are explicitly labeled test/demo workspaces, each licensed for 25 seats; one has two occupied seats and an active staff member. Do not count this as 25 newly available seats in that same court. No accounts or court registrations are fabricated by this review.
- A scheduler job is enabled every minute. The last inspected hour had 60 successful cron SQL submissions. This measures submission, not completed HTTP delivery. The updated endpoint logs elapsed time and pipeline counters without private record content so completed checks can be distinguished from cron acceptance.
- The installed production app opens the owner's existing records with “Saved.” Real TomTom imagery and route alternatives/ETAs load in the authenticated installed app. This is distinct from the fixture map checks.
- The pre-release database is approximately 26.5 MiB, with three snapshots and a largest compressed stored payload near 7.3 KiB. These are present observations, not assumptions for all future beta records.

The only hosted security advisor warning is disabled leaked-password protection: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This review does not activate a paid plan. Staff login currently uses passwords and server-verified court membership; the app does not enforce staff MFA. Keep staff credentials unique and securely handled.

## Release and operation

The new `20261105022302_beta_access_and_seat_safety.sql` migration was applied after local checks. It changes functions, grants and restrictive policies, without modifying participant/Auth/snapshot/history rows. A private in-session checkpoint verified all three existing snapshot revisions/hashes and Auth/participant/staff counts unchanged immediately after migration. Anonymous/authenticated execution of the new worker RPC is denied, service-role execution is allowed, and the arbitrary-user helper is unavailable to authenticated callers. The post-migration advisor has no new warnings. The prior function definitions and exact policy removals are kept in the reviewed rollback script. Never run a blind historical `supabase db push/reset` against this project; older local migration timestamps are consolidated.

Push one completed batch directly to `main` and let the existing Vercel Git integration deploy it. Verify the exact commit through `/api/version`, check production authorization denials/security headers, observe completed scheduler counters, then refresh the installed app and confirm records, “Saved,” and real map/routing behavior. No preview, duplicate deployment or deployment-trigger-only commit is needed.

For a gradual free beta, onboard a few users first and increase toward 25 while inspecting saves, failed checks, database/history growth and provider usage daily. History is retained and has no automatic purge. Revision-only browser polling and smaller background projections reduce egress but do not guarantee future free-tier capacity. The cost document's 100-KiB/20-saves-per-day scenario remains a stress estimate, not measured beta usage.

Real iPhone/Android installation, background notification display, participant recovery/credential handoff and independent disaster recovery still need operator/device acceptance. Reminders remain personal aids rather than guaranteed deadline delivery. Preserve synced records before reinstalling or clearing browser data. A free beta does not itself determine [Vercel Hobby eligibility](https://vercel.com/docs/plans/hobby); the provider's personal/noncommercial-use terms still apply.

## Admin installation recommendation

A dedicated **optional, online-only admin PWA** would suit staff who use the portal daily. It should have a separate manifest identity and start URL `/admin`, with normal signed-in membership checks for every operation. Current `/admin` inherits the personal app manifest, which starts at `/`; it is not a separate admin installation. Do not force installation or cache API responses, account lists, credentials, or privileged mutations for offline use. That product change is outside this security-fix batch.
