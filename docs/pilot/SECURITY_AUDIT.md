# Security audit and remediation register

> Production update, 2026-10-24: the owner approved release after backup checks. The security migration is applied and all 26 pre-existing public-table records were verified unchanged. See [release verification](PRODUCTION_RELEASE_2026-10-24.md) for current status; candidate-state statements below describe the original audit. Institutional enrollment remains subject to the listed gates.

Date: 2026-10-23. Scope: repository, all migration sources, read-only live database metadata/advisors, isolated PostgreSQL tests, local browser/build checks. No private production payloads, password values, tokens or Vault secret values were requested as evidence. This is an engineering audit, not a penetration-test attestation.

## Prioritized findings

| ID | Severity / exploitation | Initial condition | Candidate remediation / remaining gate |
|---|---|---|---|
| S01 | High: authenticated SSRF/egress abuse | Owner-writable push rows accepted arbitrary endpoints; sender trusted stored URLs | Exact HTTPS Google/Mozilla/Apple host allowlist and key bounds at API, SQL and send time; service-only atomic registration; malicious stored targets tested with zero sends. Not active in production until approved deployment |
| S02 | High: lost/stolen/shared-device access | Persistent browser session exposed mounted private workspace | Manual lock and opt-in five-minute inactivity lock; password re-verification online, cross-tab lock; drafts retained. This is UI protection, not independent key encryption; operator device policy still required |
| S03 | High: institutional access/recovery failure | Legacy non-deliverable aliases have no recovery channel; administrator MFA/enrollment unverified | Existing accounts preserved. Stop issuing new synthetic aliases; reviewed provisioning and recovery ceremony required before pilot. No new public admin endpoint or staff data access |
| S04 | High for pilot: unrecoverable outage | Hosted backup schedule/restore evidence and operational owner absent | Full disposable PostgreSQL archive restore and historical revision recovery tested; production-equivalent Supabase restore and measured RPO/RTO still blocked |
| S05 | High if regulated: unauthorized processing | No evidence of signed BAAs, approved map/push flows, HIPAA project settings or Part 2 controls | Readiness assessment and vendor/data inventory; regulated rollout remains NO-GO |
| S06 | Medium: script injection | Broad script policy; meeting links accepted untrusted schemes | Per-request nonce CSP, exact Supabase connections, no production script unsafe-inline/eval; HTTP(S)-only external links; map-worker regression tests |
| S07 | Medium: excessive privilege | Default grants on unused normalized tables; direct push credential writes/reads | Revoke unused browser grants, restrict push read columns and history/audit sequence access, protect server-derived state, revoke snapshot DELETE. All prior records retained; access changes require approval |
| S08 | Medium: account-switch race | Queued snapshot could execute using a subsequently changed SDK session | Owner-bound invoker RPC and stop starting writes after provider unmount; mismatched owner rejected by database test |
| S09 | Medium: resource exhaustion / CSRF | Private POST bodies not bounded by actual bytes; cross-origin checks inconsistent | JSON/MIME/UTF-8/8KB stream bound, same-origin checks before provider work; independent atomic device budget |
| S10 | Medium: dependency exposure | Vulnerable transitive PostCSS; unused dependency trees | Pin PostCSS through override; remove unused Firebase CLI, typography and Google GenAI SDK. Full lockfile audit run; see test report for result, not a future guarantee |
| S11 | Medium: data integrity | Millisecond-based IDs could collide; dose Undo actually skipped; repeated attendance could overwrite another recurrence | UUID identities; pure idempotent slot action/undo with inventory delta; occurrence-specific attendance timestamps |
| S12 | Medium: incomplete operational audit | No app security metadata trail | Snapshot-write and device-transition audit added, no payloads. Not a complete read/access/admin log; privileged DB operators can alter it |
| S13 | Medium: auth password policy | Live advisor warns leaked-password protection disabled; live MFA factors count zero | Record and verify provider plan/config and admin MFA before enrollment; no unauthorized setting/paid change performed |
| S14 | Medium: data lifecycle | Exports plaintext; deletions survive history/backups; no complete account erasure | Explicit export warning retained and tested; retention/deletion runbook; full erasure remains an enrollment gate |
| S15 | Medium: shared storage/runtime exhaustion | Snapshots are whole JSON, retained indefinitely; direct owner Data API writes do not enforce a tenant storage budget or RPC-only CAS | Existing data preserved; load/storage measurements, approved retention and per-tenant budget design remain pilot gates. Private map/device rate limits do not solve snapshot growth |

No cross-user snapshot disclosure was demonstrated in the audited live ownership predicates. This does not establish absence of every authorization flaw. Three-user SQL negative tests validate candidate grants/policies, not internet JWT verification or real multi-device behavior.

## Control review

Authentication uses `getUser()` online, a locally cached unexpired session only for offline device access, generic sign-in errors, provider password hashing and bounded private APIs. Browser tokens remain script-accessible by SDK design; sameSite/secure cookie options do not make them HttpOnly. Public sign-up and anonymous Auth must be confirmed disabled in provider settings; absence of a UI is insufficient. Signup/config changes were not performed during this audit.

The live advisor's service-only receipt-table RLS INFO is not evidence of a public disclosure: browser grants were absent. The candidate adds an explicit service policy. Do not enable a broad authenticated policy merely to silence an advisor.

Input sanitation and CSP reduce XSS risk but cannot protect an origin after its code/extension/build pipeline is compromised. JSON snapshots and infrastructure backups are readable to authorized operators. Secret scan covers current Git source for known credential formats; historical exposure and provider-side secret scanning remain separate reviews.

## Release and evidence boundary

`20261024040536_personal_security_baseline.sql` is pending and deliberately changes grants. It must not be applied merely because this branch is pushed. Candidate code depends on its new RPCs. Apply first to an isolated Supabase project, run actual Auth/Data API tests and advisor review, inspect existing integrations, take a verified backup, obtain explicit production approval, then coordinate one release. See [deployment/rollback](PILOT_DEPLOYMENT_GUIDE.md).
