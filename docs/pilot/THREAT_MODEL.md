# Threat model

Date: 2026-10-23. Assets: private schedule/health/budget/location records, session/refresh tokens, push capabilities, cloud history, device queue, credentials, participant autonomy and reliable self-reports.

## Actors and boundaries

Untrusted internet clients can call public routes/Auth. An authenticated participant can craft Data API requests and arbitrary JSON, not just use UI controls. A lost unlocked device, malicious extension or injected same-origin script can operate with its user's browser authority. A compromised CI/provider/admin account can affect many participants. Institutions may pressure participants for access or exports; technical ownership alone does not remove coercion risk.

Trust boundaries are browser -> Auth/Data API, browser -> Vercel authenticated routes, Vercel -> service-role database/third-party APIs, cron -> Edge -> Vercel, and OS push -> account-scoped navigation. See [data flow](SYSTEM_ARCHITECTURE.md).

| Threat | Attack | Controls / evidence | Residual treatment |
|---|---|---|---|
| Spoofing / IDOR | Forge account UUID, target another snapshot/dose/budget/route | `auth.uid()` owner predicates; authenticated API `getUser`; three-account negative SQL tests | Actual expired/forged JWT Data API tests on isolated hosted Supabase required |
| Cross-account device hijack | Register another endpoint, switch signed-in identity while save queued | Service-only registration, prior key proof, single active endpoint owner, owner-bound snapshot RPC | Device compromise exposes capabilities; real account-switch push drill required |
| SSRF / egress | Store localhost/metadata push endpoint then invoke sender | Exact HTTPS host/key allowlists at read and registration; zero-network malicious-row test | New browser push provider requires reviewed allowlist update |
| XSS / credential theft | Malicious meeting URL or injected script | HTTP(S) links, React escaping, nonce CSP, same-origin worker, fixed connect origins | Browser keys/tokens remain usable to compromised same-origin code; no absolute XSS immunity |
| CSRF / denial of service | Cross-site POST, huge chunked JSON, API bursts | Origin/fetch-metadata rejection, actual-byte cap, per-user scoped atomic budgets | Platform WAF/Auth brute-force controls and internet load testing still unverified |
| Tampering / data loss | Replay stale whole snapshot; duplicate action; conflicting recurrence | CAS, local-first encryption, UUIDs, idempotent exact-slot actions, distinct occurrence IDs | Conflict stops for manual export/recovery; no automatic merge; browser eviction remains possible |
| False adherence | Treat delivered reminder as medication/attendance | Explicit participant actions only; provider receipts separate from logs | OS display/ack telemetry incomplete; alerts are not proof |
| Repudiation / operator misuse | Read participant data via dashboard/service key | No staff portal; minimal new write/device audit; least-privilege runbook | Infrastructure admins can read/alter records/audit; full admin/read audit and dual review needed |
| Lost shared device | Persistent session or plaintext exported file | Optional lock, online password verification, export warning | Cache keys share origin; logout is not wipe; OS lock/encryption and revocation drill required |
| Institutional overreach | Reuse private records for sanctions or surveillance | No default sharing/score/staff role; participant-first notice | Consent and legal governance are external prerequisites; no hidden access guarantee |
| Supply chain / outage | Vulnerable build dependency, compromised key, failed provider | Pinned lockfile, dependency/secret scan, safe errors, independent reminder/travel pipelines | Review dependency alerts continuously; hosted recovery and alert ownership required |

## Accepted design constraints versus approval gates

The personal app keeps its existing snapshot architecture; no new central surveillance model or field-level cloud encryption rewrite is introduced. Offline full snapshots and origin-held device keys are documented constraints, not evidence of encrypted protection from operators. No decision-maker has accepted high pilot risks. The audit register identifies rollout blockers and the deployment guide makes approval a final explicit step.
