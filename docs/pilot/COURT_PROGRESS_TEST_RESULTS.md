# Court progress reporting validation

Validation date: November 6, 2026. Base: `cdd6043f1b447e7976584a48104896880b62c0fa`. Branch: `codex/consented-court-progress`.

This is local implementation evidence. No production migration, court-flag change, deployment, account mutation or real participant backfill was performed. Production/main remains the version under evaluation. Hosted-service end-to-end behavior and operational query plans remain unverified.

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Pass | Entire application and tests |
| ESLint | Pass | Entire repository source |
| Focused secret scan | Pass | Source files; local credential-bearing exports ignored |
| Unit/API tests | 149 passed | Includes actual reporting handlers and existing auth/session guards with isolated dependencies |
| Disposable PostgreSQL migration/security tests | 14 passed | All 19 migrations, RLS/privilege denial, real invoker RPC authorization and atomic private-save triggers |
| Production-build browser regression suite | 44 passed | Owner onboarding, staff credentials/access, participant provisioning, check-ins and reporting; desktop/mobile |
| Final reporting browser checks | 10 passed | Consent, explicit history, review notice, report denial, default-off and tablet-width layout; desktop/mobile projects |
| Application production build | Pass | Local Next.js build; no deployment |
| Visual inspection | Pass | Fictional participant consent and staff reporting screens on desktop/mobile |

The 10 final reporting checks overlap the broader browser suite and add tablet-width checks; they are not 54 distinct scenarios. Browser responses use explicit synthetic test fixtures. Database tests execute the real migration and functions against isolated PGlite PostgreSQL. These two test layers do not establish working hosted services.

## Reporting security cases exercised

- Six reporting tables have RLS enabled. Anonymous and authenticated roles, including participant, staff and owner identities, cannot directly read the tables or execute service-only RPCs.
- A verified HTTP session supplies the actor. Client attempts to inject another user, court, notes, medications or coordinates are rejected. Cross-origin mutations fail.
- Staff require the existing court membership, alias, temporary-password and reset-session checks. PostgreSQL independently rejects another court's staff, revoked staff, required-password-change staff, invalid post-reset sessions and owners, even an owner also given staff membership.
- Missing court feature flags mean disabled. Category consent and individual selection are both required. A category toggle alone publishes nothing. Old scheduled data and completion timestamps are excluded without explicit history choice.
- Only Court/Case management/Class appointments and individually selected tasks linked to Court/Case management can contribute. Medication, therapy, drug-test, self-help, unrelated task, money, note, contact and GPS sentinels do not appear in staff report JSON.
- Private attendance and task corrections, undo-like saves, source deletion, lost task eligibility, rescheduling and recurrence changes remove stale completions. Schedule/link changes require participant review/reselection. Timezone conversion is checked with appointment and profile timezone inputs.
- Withdrawal, suspension/removal, court disable and flag disable hide reports and end consent. Restoration does not resume sharing. Private snapshots and the 25-seat limit are preserved.
- Successful report reads create scoped access-audit entries. A forced audit constraint failure denies the read transaction. Denied reads do not create successful-access records.
- The existing 25-participant capacity, onboarding, seat release, staff employment history, private RLS, save CAS/recovery and subscription lifecycle tests remain passing.

## Review and rollout gate

Review the migration, [privacy/lifecycle design](COURT_PROGRESS_REPORTING.md) and [hands-on test supplement](COURT_PROGRESS_TEST_GUIDE.md). Before requesting production rollout, use an isolated hosted test project with real fictional Auth identities, run hosted advisors, exercise concurrent consent/private-save/revocation cases, validate installed PWA behavior, and agree reporting retention and consent language. No hosted validation has been represented as complete.

Keep reporting disabled for the initial pilot even if a later deployment is approved. The branch blocks its own Vercel preview deployment. Merging, production schema/settings changes and deployment require explicit approval.
