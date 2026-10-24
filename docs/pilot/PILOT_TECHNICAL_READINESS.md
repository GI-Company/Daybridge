# Pilot technical readiness and final engineering report

Assessment date: 2026-10-23. Intended pilot: approximately 20–30 voluntary participants for 90 days. Candidate branch: `feat/daybridge-pilot-security-hardening`. Production and existing records remain unchanged by this branch. This report is suitable for preliminary partner review, not an assurance of production readiness or HIPAA certification.

## Recommendation

**NO-GO for enrollment of real institutional participants or regulated data at this stage.** Synthetic review on the isolated branch is appropriate. Candidate improvements are substantial, but high risks have not been accepted and the hosted identity/recovery, device, operational and contractual gates below are unverified. Do not merge just to “test in production” using existing participant records.

The user's current personal records and functioning application must be preserved. Before any approved production release, verify recoverable backups, migration record preservation, existing feature regressions, old-client compatibility and a concrete rollback path. No live migration, paid activation, credential change or user-access change is authorized by this report.

## Delivered improvements

| Area | Candidate result |
|---|---|
| API / delivery security | Strict push-provider validation even for stored rows, bounded JSON and same-origin POST/DELETE handling, independent device rate budget, generic routine notification text |
| Browser protection | Per-request nonce CSP; exact Supabase connect origins; same-origin map worker retained; secure/sameSite cookie options; HSTS/COOP and safe meeting URLs |
| Identity / device | Online password lock, manual and opt-in inactivity lock, draft-preserving mount, account-keyed workspace; existing accounts unchanged |
| Sync / integrity | Owner-bound save RPC; stop starting saves after unmount; UUID record identities; exact occurrence attendance; idempotent explicit medication actions and real undo with stock correction |
| Database | Non-destructive pending migration narrows unused/default grants and push key exposure; service-only atomic device RPCs; metadata audit table/trigger; prior snapshot RPC/history retained |
| Operations | Minimal liveness endpoint, focused secret/dependency checks and expanded CI; twelve pilot documents, threat/data-flow/vendor inventories, recovery and incident runbooks |

## Evidence and test boundary

Local results and coverage are recorded in [test evidence](evidence/TEST_RESULTS.md) and the [RLS report](SUPABASE_RLS_TEST_REPORT.md). Browser fixtures use production components and actual IndexedDB/WebGL/worker behavior with synthetic transport/tile responses. They do not prove production TomTom, push display, signed hosted JWTs or real iPhone/Android background behavior. Full dependency scans report known advisories only; they are not a general vulnerability certification.

The candidate SQL was executed on disposable PostgreSQL with existing synthetic rows and a second-database archive restore. It was **not applied to the live Supabase project**. No staging/preview deployment was created. GitHub Actions remote execution availability remains an account-level gate; local success is not a fabricated remote CI pass.

## Enrollment gates and accountable evidence

| Gate | Owner to assign | Evidence required |
|---|---|---|
| Preserve existing personal production | Product owner + release reviewer | Verified backup/recovery; all-row migration diff, existing feature and rollback acceptance; explicit commit/migration approval |
| Hosted identity and isolation | Backend/security operator | Three real synthetic Auth users; expired/forged/anonymous HTTP denials, multi-connection CAS, advisor results |
| Provisioning and recovery | Auth administrator | Closed signup/anonymous settings; admin MFA; secure initial credential/recovery ceremony, no new synthetic aliases; lost-device revocation drill |
| Retention and withdrawal | Privacy owner + counsel | Approved retention periods, current/history/backup deletion and legal-hold behavior, participant notice and tested erasure |
| Hosted backup and DR | Infrastructure operator | Auth/project/secret configuration recovery, measured RPO/RTO, independent protected backup custody |
| Physical devices | QA + participant support | Installed iPhone/iPad, Android and signed-in macOS app; offline/reconnect/account-switch/update, maps and real push open/closed/permission-revocation tests |
| Notification reliability | Operator | Scheduler liveness and failure alerts, queue retry/dedupe measurements, actual device display; explain acceptance vs completion |
| Capacity and costs | Operator + sponsor | Synthetic 30-account load, <=60-second job headroom, full-snapshot egress/history growth, budget and alert owners |
| Institutional privacy | Sponsor + privacy/legal | Voluntary consent/withdrawal, no sanctions/surveillance sharing, staff cannot view records by default, administrative access controls |
| Regulated use if applicable | Counsel + vendor owners | Covered-entity/BA and Part 2 determination; signed BAAs, Supabase add-on/project controls, Vercel and map/push scope, policies/training |

## Platform coverage

Desktop Chromium and Pixel 7 Chromium emulation have automated coverage. These are browser profiles, not physical Android devices. No installed iOS/iPadOS, physical Android or signed-in macOS PWA walkthrough has been verified for this candidate. Apple supports Web Push for Home Screen apps starting with iOS/iPadOS 16.4, subject to installation/permission and OS behavior; see [WebKit](https://webkit.org/blog/13878/). MapLibre requires WebGL2. Offline access requires a previously loaded shell/cache and an unexpired cached session; a new online login is not available offline. Automatic lock is optional because unlocking requires online verification.

## Documents for partner review

[Architecture](SYSTEM_ARCHITECTURE.md), [audit/remediation](SECURITY_AUDIT.md), [data classification](DATA_FLOW_AND_CLASSIFICATION.md), [HIPAA gaps](HIPAA_READINESS_GAP_ANALYSIS.md), [threat model](THREAT_MODEL.md), [RLS evidence](SUPABASE_RLS_TEST_REPORT.md), [retention/deletion](DATA_RETENTION_AND_DELETION.md), [backup/recovery](BACKUP_AND_RECOVERY.md), [incident response](INCIDENT_RESPONSE.md), [deployment/rollback](PILOT_DEPLOYMENT_GUIDE.md), [cost/capacity model](ESTIMATED_INFRASTRUCTURE_COSTS.md).

Exact source files and database objects are listed in [change inventory](CHANGE_INVENTORY.md). Contracts, legal determinations, paid services and existing-user access changes require separate approval. High findings in the audit register remain blockers until resolved or explicitly accepted by authorized decision-makers.
