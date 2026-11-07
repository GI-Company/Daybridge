# November 7 audit remediation

The nine confirmed findings in the November 7 audit are addressed together.

- Browser RLS requires a live Auth session ID in addition to current participant entitlement. Password resets cannot re-enable an old, revoked JWT after setup. The service-only reminder helper remains independent of browser sessions.
- Transient access checks preserve mounted records, unfinished forms and the encrypted save queue. An encrypted per-user grant allows device access for at most 24 hours after an online authorization; existing Auth session checks still apply. Explicit denials invalidate the grant and hide the mounted workspace, pausing location access. The grant never bypasses cloud RLS.
- New bill payments and paycheck deposits carry stable operation identities for their bill occurrence or payday. Merges count the same operation once; different amounts/accounts require an atomic choice. Existing manual and legacy ledger entries are preserved because their origin cannot safely be inferred.
- Undo, redo and remote application rebuild payment guards. The UI reports success only when a payment was recorded.
- The travel worker selects due plans before its 60-route-calculation batch limit. Attempt timestamps rotate failed/unprocessed work; successfully checked work respects the existing timing intervals. Real TomTom routes and interactive maps remain in use.
- Court settings are disabled during saving, preventing newer edits from being discarded when the response arrives.
- Virtual appointments persist a validated meeting URL. Safe legacy virtual links stored in location also render as Join links.
- The database enforces a 2 MiB snapshot limit and 120 changed writes per minute per account across RPC and direct writes. New recovery history retains the newest 50 revisions within 8 MiB per account. Every pre-policy backup is protected. A transaction-level fingerprint guard verifies the migration leaves every existing snapshot and backup unchanged. Recovery UI discloses the policy; save-limit errors preserve the encrypted device copy and explain the next step.
- Browser tests accept confirmation dialogs where completion is intended and separately verify cancellation. Reminder coverage now exercises the per-appointment control and persistence instead of removed global settings.

The migration must land before the application commit because the travel worker uses its service-only due-work RPC. Do not replay old migrations. The regression suite uses disposable PostgreSQL and simulated browser services; production Auth/database/deployment checks must be reported separately and do not establish real route-provider or push-delivery success.

## Verification

- Node 24: 152 unit tests, 11 disposable-database tests and 140 desktop/mobile browser tests passed. Two optional demo recordings were skipped. Production build, TypeScript, lint and focused secret scan passed.
- Hosted migration `20261107232250`: preservation guard passed; all 4 existing snapshots and 196 pre-policy recovery copies remained present.
- A hosted transactional test verified current-session access, old-session denial during and after reset setup, new-session access, direct-write size rejection, RPC write-rate rejection, and service-only entitlement/due-work execution. All synthetic records were rolled back. This tests hosted database authorization, not an end-to-end Auth password reset through the staff portal.
- Security advisors report no new warning/error from this migration. The existing leaked-password-protection warning remains. Private service/trigger tables intentionally deny browser access with RLS and no policies.
