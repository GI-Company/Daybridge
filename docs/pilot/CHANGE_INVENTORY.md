# Exact candidate change inventory

Base: production/main `97b7d4cdc9418226ff10f077602754453edafb54`. Candidate branch includes the preview-deployment guard plus the paths below. No existing production record or account was modified. Git diff against this base is the authoritative content diff.

## Database objects

Migration: `supabase/migrations/20261024040536_personal_security_baseline.sql` (applied live on 2026-10-24 after explicit owner approval and backup verification).

- New table/index/identity sequence: `private_security_audit`, `private_security_audit_owner_recent`, `private_security_audit_id_seq`.
- New trigger/function: `audit_private_snapshot` on `private_snapshots`; `audit_private_snapshot_write()` (definer, fixed search path, no public execution).
- New service-only invoker functions: `register_private_push_device(uuid,text,text,text)`, `disable_private_push_device(uuid,text)`.
- New authenticated owner-bound invoker function: `save_private_snapshot_for_user(uuid,jsonb,bigint)`; old `save_private_snapshot(jsonb,bigint)` retained.
- Changed constraint/function: `travel_request_limits_scope_check`, `take_scoped_travel_api_slot(uuid,timestamptz,text,integer)` (adds device scope).
- Policies: restrict `Owner read push_subscriptions` to authenticated; service-only receipts policy; owner-read/service-read/service-append audit policies.
- Grants: revoke browser/public access on the 16 unused normalized tables listed in architecture; restrict push reads to user_id/endpoint/disabled_at; server-derived delivery/estimate read-only; revoke snapshot DELETE; restrict history/audit sequence privileges. Existing owner RLS/history and all record values retained.

The owner explicitly approved these access changes for production on 2026-10-24. No DROP TABLE, TRUNCATE, live purge, credential rotation or existing identity rewrite is included.

## Source, test and documentation paths

- `.github/workflows/validate.yml`
- `KNOWN_LIMITATIONS.md`
- `PRIVACY.md`
- `README.md`
- `SECURITY.md`
- `USERNAME_AUTH.md`
- `app/api/cron/travel/route.ts`
- `app/api/health/route.ts`
- `app/api/notifications/device/route.ts`
- `app/api/travel/geocode/route.ts`
- `app/api/travel/places/route.ts`
- `app/api/travel/push-test/route.ts`
- `app/api/travel/route/route.ts`
- `app/layout.tsx`
- `components/common/DeviceLockSettings.tsx`
- `components/common/SecureAppGate.tsx`
- `components/common/SessionLock.tsx`
- `components/health/HealthView.tsx`
- `components/schedule/ScheduleView.tsx`
- `components/settings/SettingsView.tsx`
- `components/today/TodayView.tsx`
- `docs/pilot/BACKUP_AND_RECOVERY.md`
- `docs/pilot/CHANGE_INVENTORY.md`
- `docs/pilot/DATA_FLOW_AND_CLASSIFICATION.md`
- `docs/pilot/DATA_RETENTION_AND_DELETION.md`
- `docs/pilot/ESTIMATED_INFRASTRUCTURE_COSTS.md`
- `docs/pilot/HIPAA_READINESS_GAP_ANALYSIS.md`
- `docs/pilot/INCIDENT_RESPONSE.md`
- `docs/pilot/PILOT_DEPLOYMENT_GUIDE.md`
- `docs/pilot/PILOT_TECHNICAL_READINESS.md`
- `docs/pilot/PRODUCTION_RELEASE_2026-10-24.md`
- `docs/pilot/SECURITY_AUDIT.md`
- `docs/pilot/SUPABASE_RLS_TEST_REPORT.md`
- `docs/pilot/SYSTEM_ARCHITECTURE.md`
- `docs/pilot/THREAT_MODEL.md`
- `docs/pilot/evidence/TEST_RESULTS.md`
- `docs/pilot/evidence/dependency-audit-summary.json`
- `docs/pilot/evidence/rls-report.json`
- `lib/auth/username.ts`
- `lib/notifications/delivery.ts`
- `lib/notifications/reminders.ts`
- `lib/security/policy.ts`
- `lib/security/request.ts`
- `lib/security/urls.ts`
- `lib/storage/dose-change.ts`
- `lib/storage/record-id.ts`
- `lib/storage/store.tsx`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/travel/auth.ts`
- `lib/travel/rate-limit.ts`
- `lib/types.ts`
- `middleware.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `scripts/scan-secrets.mjs`
- `scripts/test-maps.mjs`
- `supabase/migrations/20261024040536_personal_security_baseline.sql`
- `tests/browser/MapHarness.tsx`
- `tests/browser/SecurityHarness.tsx`
- `tests/browser/security.spec.ts`
- `tests/notification-delivery.test.ts`
- `tests/rls-harness.mjs`
- `tests/rls-isolation.test.mjs`
- `tests/security.test.ts`
- `vercel.json`
