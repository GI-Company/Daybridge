# Backup and recovery

Date: 2026-10-23. Preserve all existing records and working functionality on every deployment and migration. This branch performed no production restore, purge, reset or backup export of private data.

## What was tested

`npm run test:db` applies all migration files to disposable PGlite PostgreSQL. It seeds three synthetic accounts before the candidate migration, compares existing public-table rows before/after, tests owner isolation and restores a prior account snapshot as a new revision. It then uses a full PGlite data-directory archive to start a second database and verifies snapshots, history, security audit, grants and RLS there.

This is an actual embedded PostgreSQL archive restore, **not** a Supabase hosted backup/PITR drill. Supabase Auth service state, real JWT validation, Vault credentials, Edge deployments, Cron execution, network/storage policies, managed encryption and physical devices are not proven by it. See [PGlite archive API](https://pglite.dev/docs/api).

## Layers and failure limits

| Layer | Use | Cannot cover |
|---|---|---|
| Encrypted IndexedDB dirty snapshot | Recover unsynced edits on the same origin/profile | Device loss, storage clearing/eviction, compromised origin or missing key |
| Owner cloud revision history | Inspect/export an earlier record state | Entire project/account loss; incorrect retention; Auth/Vault/Edge restoration |
| Hosted provider backup/PITR | Planned project recovery | Not verified active; plan-dependent; external configuration and credentials may need separate recovery |
| Controlled offline backup | Independent recovery copy with access controls | Not provisioned or verified; raw exports themselves are sensitive |

Proposed pilot targets: cloud RPO <=24 hours and RTO <=1 business day, with acknowledgment that unsynced lost-device edits may be unrecoverable. These are targets for approval and measurement, not achieved guarantees. A participant-critical notification service may need tighter targets and a separate continuity plan.

## Required hosted recovery drill

1. Name primary operator, independent reviewer and privacy contact. Approve backup location, encryption, custody, retention and restore budget before copying records.
2. Obtain provider backup availability and documented scope. Use an isolated project with synthetic records first. Inventory schema/migration versions, Auth identities, object storage (none currently), Edge code, Cron schedules and secret **names**. Store secret values separately in approved custody; never in Git or reports.
3. Restore into a new isolated target, never over the existing production project. Keep outbound notification/cron dispatch disabled and use isolated map/push credentials so a drill cannot contact real participants.
4. Validate record counts and content checksums inside the secured environment; output only aggregate pass/fail evidence. Exercise three independent users with real Auth tokens, owner RLS, stale revisions, app login, offline cache recovery and rollback compatibility.
5. Test losing one identity, one snapshot revision, all app tables and a hosted project separately. Verify how existing Auth UUIDs and session invalidation behave; do not assign an old snapshot to a new UUID without reviewed authorization.
6. Measure restore elapsed time and recoverable cutoff. Document missing components and repeat until approved RPO/RTO are met. Delete synthetic drill resources only after scope/ownership is confirmed; paid resources require approval.

## Pre-release backup gate

Before any production migration or deployment: verify a recoverable backup, record schema/app versions, preserve pending device work, validate migration preservation and feature regressions, and obtain explicit production approval. If any gate fails, stop the release. CI must not auto-run database migrations. A code rollback does not automatically undo SQL grants or recover cloud data.

## Snapshot conflict recovery

Keep the affected device open. Export its pending records privately; verify account and revision on the server without public disclosure. Compare both versions in a controlled environment. Resolve intentionally, submit through the expected-revision RPC and verify on a second device. Do not clear IndexedDB, reinstall, force an empty snapshot or bypass CAS to “fix sync.” Independent deletions are represented by whole-snapshot state; an uninformed merge can resurrect removed items.
