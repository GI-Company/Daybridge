# Pilot deployment and rollback guide

Date: 2026-10-23. **Every deployment and migration must preserve existing records and working functionality.** The feature branch is for review; production `main` remains unchanged. No preview deployment, production SQL, credential change, record deletion, paid service or existing-user access change is authorized by creating/pushing this branch.

## Candidate changes and order

The pending migration is `supabase/migrations/20261024031314_personal_security_baseline.sql`. It retains all tables/records, narrows grants, adds security audit/trigger, introduces service-only device registration/disable RPCs, extends the device rate scope and adds an owner-bound snapshot-save RPC. Existing two-argument snapshot RPC and revision history are preserved for old clients and rollback. New app/server code requires the new RPCs; **do not release application code before the migration is applied and verified in the target environment**.

The candidate restricts unused normalized browser APIs. Verify no external client depends on them before approval. The current app reads snapshots, not those tables. Old device-registration server code needs replacement alongside the migration. UI lock is opt-in for automatic inactivity to preserve existing offline behavior; manual lock requires internet to unlock.

## Isolated validation first

1. Create or select an explicitly approved disposable Supabase project; do not point tests at the connected production project. Use synthetic users and separate Auth, TomTom, VAPID and cron configuration. No project was provisioned in this work.
2. Apply migrations in order with the normal reviewed migration tool. Match existing migration history; do not replay already installed files or reset a project. Confirm no destructive statements or user record rewrites are introduced.
3. Run local checks below and actual hosted Auth/Data API negative tests for three users: anonymous, expired/forged token, cross-user read/update/delete/owner reassignment, privileged RPC denial, device ownership transfer, concurrent CAS, logout/switch and recovery. Use real signed synthetic sessions, not a role-setting fixture as JWT proof.
4. Run Supabase advisors; verify exposed schemas, views (`security_invoker` if introduced), buckets/policies, SECURITY DEFINER permissions, fixed search paths and table/function grants. Review public signup/anonymous settings, Auth rate/password protections, redirect allowlist and administrative MFA. Changes to production settings need explicit approval.
5. Perform the hosted backup/restore drill, compare all existing rows before/after the candidate migration inside the protected environment, verify older client behavior and roll back the app without erasing data. Never print participant row contents or hashes usable as identifiers into public CI artifacts.

```bash
npm ci
npm run typecheck
npm run lint
npm run security:scan
npm audit --audit-level=moderate
npm test
npm run test:db
npm run test:browser:production
npm run build
```

`test:browser:production` briefly creates a synthetic test route and removes it. The final `build` must occur after cleanup. Fixture tests verify rendering/state behavior; they do not establish working production services. CI includes these checks and must never automatically migrate production. Hosted CI billing availability must be confirmed separately.

## Environment and release gates

Browser variables: only public Supabase URL/publishable key. Private variables: Supabase service credential, TomTom/map key(s), cron secret and VAPID private key. Use approved secret storage; never expose private variables through `NEXT_PUBLIC_*`, exports or logs. Stage and production must have distinct identities, records, domains, push keys and outbound cron targets. No staging deployment exists yet. The feature branch's `vercel.json` disables automatic deployments to conserve the user's free quota.

Before the single approved production release, record backup/recovery evidence, pass data-preservation and current-feature tests, verify pending work on existing devices, review exact SQL/grant differences and obtain explicit owner approval for the migration/access changes and deployment. Schedule a coordinated maintenance window if atomic code/schema rollout cannot be guaranteed. The reviewer should approve a concrete commit/migration pair. No empty deploy-trigger commits or duplicate CLI deployments.

## Production acceptance after approval

Apply only the reviewed pending migration, verify metadata/rows privately, then promote the approved code through the existing main Git integration once. Confirm exact `/api/version` commit, no unexpected preview deployments, `/api/health`, signed-in installed app, interactive street/traffic/route/search, calendar-inferred trip, medication/undo, budget, offline edits/reconnect, account switching, update protection and item notification destinations. Register fresh synthetic devices to test real provider acceptance and OS display with app open/closed, timezone/DST/quiet hours and permission revocation. Avoid messages to real participants during acceptance.

## Rollback without data loss

Prefer an application rollback to the previous production commit while **retaining additive database schema and data**. Preserve all new snapshots/history/audit and both save RPCs. A rollback of SQL files in Git does not reverse applied migrations. New `inventoryDelta` fields are optional; old clients may ignore them but must preserve unknown snapshot fields. Verify old clients preserve newly introduced data before permitting concurrent rollback use.

If a narrowed grant breaks a verified legacy integration, inspect and approve a minimal forward corrective grant; do not grant ALL/public or revert the security migration wholesale. If data is damaged, restore into a separate target and reconcile by account/revision using the recovery runbook. Do not overwrite production with an earlier dump or delete IndexedDB to suppress conflicts. Any SQL rollback/correction must be reviewed and separately authorized.
