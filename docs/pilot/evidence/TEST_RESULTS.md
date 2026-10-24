# Executed local verification

Review date: 2026-10-23 (America/New_York). These are local candidate checks, not production service acceptance or a remote CI pass. Fixtures are synthetic. Production `main` and `/api/version` remained `97b7d4cdc9418226ff10f077602754453edafb54` at the read-only release check.

| Command | Actual result | Coverage / limitation |
|---|---|---|
| `npm test` | PASS, 61 tests | Calendar/recurrence, DST/timezones, reminders, delivery retry/dedupe, SW navigation, medication/stock/undo, finance, request bounds/origins, push SSRF validation, IDs and CSP construction |
| `npm run test:db` | PASS, 1 test / 29 named groups | All 12 migrations, three synthetic role identities, existing-row preservation, RLS/privileged denial, push ownership, sequence protection, stale revisions, historical recovery and second-database full archive restore |
| `npm run test:browser:production` | PASS, 54 tests | Production build; desktop/mobile Chromium, real MapLibre worker/WebGL with synthetic tiles/transport; exact notification navigation, offline encrypted reload/flush/delete, account switching, conflict preservation, export, explicit dose/undo, recurrence identity, auth gate fixtures, CSP parser-injection denial, update/draft protection and cross-tab lock |
| `npm run test:browser:production -- tests/browser/security.spec.ts --grep 'session lock|manual locking'` | PASS, 6 tests after final lock persistence adjustment | Rechecks draft preservation, incorrect/offline unlock, idle timeout, existing tabs and newly opened locked tab |
| `npm run typecheck` | PASS | TypeScript no-emit check; production builds also check types |
| `npm run lint` | PASS | Existing Next ESLint rules; production build also lints |
| `npm run security:scan` | PASS | Current tracked/untracked non-ignored source, focused known secret formats only; no historical or comprehensive provider scan |
| `npm audit --json` | PASS, 0 known advisories across production and development dependencies | Registry result at review time; retained metadata in dependency-audit-summary.json |
| `npm run build` | PASS | Clean deployable build after harness cleanup; no map-test-internal route in route inventory |
| `git diff --check` | PASS | Patch whitespace validation |

Earlier new-test failures were investigated and corrected before these passes: fixture hydration/layout and assertion races, route-announcer selector ambiguity, and a CSP test that initially exercised trusted dynamic script creation rather than parser-injected untrusted markup. No security control was disabled. Save/reload tests now poll the synthetic persisted transport state, rather than treating a transient UI status as proof of a saved record.

Full browser run: 54 passed. The final lock change was checked with six focused production browser tests; it does not claim a second full 54-test run on that exact subsequent tree. Final deployable build and type checks ran after that change. The test harness is temporary and removed by the runner; browser traces/downloads remain ignored local artifacts.

## Not executed / not established

- Hosted Supabase GoTrue signed/expired/forged JWT, signup configuration, real concurrent database sessions, full Auth/Vault/Edge/PITR recovery and advisor results on the unapplied candidate schema.
- Physical installed iOS/iPadOS, Android and signed-in macOS app behavior; real provider push display/acknowledgment; candidate production TomTom/PWA services.
- Complete account erasure/backup expiry, secure new username provisioning/recovery, administrative MFA enforcement, 30-account load, operational alert delivery or legal/vendor contracts.
- Remote GitHub Actions success. [Branch run 40060351560](https://github.com/GI-Company/Daybridge/actions/runs/40060351560) for code/document commit `0a4bdad9f384c2f2a9636d61daf4599ce81eee38` stopped before tests: GitHub reported “The job was not started because your account is locked due to a billing issue.” No remote test pass is claimed. Later documentation-only commits do not change the tested code.

No production migrations, credentials, records or existing-user access were changed. No preview or production deployment was triggered intentionally. See the deployment guide for explicit approval and data-preservation gates.
