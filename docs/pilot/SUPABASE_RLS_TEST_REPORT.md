# Supabase authorization and migration test report

Date: 2026-10-23. Command: `npm run test:db`. Source: `tests/rls-harness.mjs`, `tests/rls-isolation.test.mjs`. Retained synthetic evidence: [RLS result](evidence/rls-report.json). No real participant records or credentials were used.

## Read-only production findings

Metadata inspection found 26 public tables with RLS enabled, no public views, no Storage buckets/policies, and two Auth accounts. MFA factor count was zero. Advisor warned that leaked-password protection was disabled; a service-only receipt table had an RLS-without-policy INFO. Default legacy table grants and direct browser push writes were broader than needed. Sensitive field values, Auth identities and Vault secrets were not retrieved for these findings. Provider security settings and administrative organization MFA were not changed.

## Executed candidate database checks

The test applies all 12 SQL migrations unchanged to actual PGlite PostgreSQL, with three distinct synthetic UUID identities. It creates equivalent `anon`, `authenticated` and `service_role` roles plus minimal Auth/Cron/Vault scaffolding. Existing synthetic snapshots, travel settings/plans and representative normalized calendar/medication/budget rows are inserted **before** the security migration. It compares every pre-existing public-table row after migration using sorted normalized JSON; no record is dropped or altered.

The suite contains one Node test with 29 named assertions/groups in the retained report:

- Each owner reads only its own full snapshot; A/B/C cannot read each other's schedules, medication/dose, budget, saved-location payloads, travel plans/preferences or revision history.
- Cross-owner update returns no rows; delete, owner reassignment and unauthorized insert fail. Unused normalized table reads are denied after least-privilege revocation while records remain preserved for operators.
- Anonymous/missing identity cannot save or access sensitive tables. Forged payload UUIDs and a user-set role-like metadata claim do not change the database's authoritative role/owner.
- Authenticated users cannot read push encryption keys, alter history/audit sequences, append security audit rows, invoke cron-secret validation, consume service limiter RPCs, register/disable another private push device through service RPCs or access provider receipts.
- An owner-bound queued save rejects a different originating UUID. Stale compare-and-swap revisions cannot overwrite newer data. Historical recovery restores a previous synthetic snapshot as a new revision and preserves history.
- Atomic device registration requires the existing keys before switching an active endpoint's owner; there is only one active owner. Disabling as a different account does not affect it. Device rate budgets reject the third call after a budget of two.
- Other synthetic accounts remain unchanged after attacks/recovery. A full archive restores into a second disposable database with records, history, audit, grants and RLS rechecked.

## What these results do not prove

Role fixtures do **not** validate GoTrue JWT signatures, actual token expiry/refresh, direct hosted REST/RPC authentication, session revocation, provider abuse protections or administrative MFA. Browser auth tests separately validate gate behavior with simulated sessions; they are not a replacement for real signed-token tests.

PGlite uses one connection. Stale-revision rejection is tested, but genuine multi-connection contention/advisory locks must be exercised on isolated hosted Supabase. Cron/Vault scaffolding does not execute the real scheduler or retrieve secrets. No hosted advisor run exists for this unapplied candidate schema. The live advisor reflects the prior deployed schema only. Public Storage coverage is “not provisioned,” not a passing private-object access test.

## Remaining required hosted acceptance

Create three independent synthetic Auth accounts in an approved isolated Supabase project. Test actual HTTP calls with their signed JWTs, no token, expired token, forged token and forged target identifiers. Cover every exposed table/RPC, direct writes, provider registration, owner switching and simultaneous saves. Confirm invalid tokens cannot reach service operations; verify signup is disabled and unauthorized administrative requests are rejected. Run advisors and capture aggregate results, not tokens or record contents. No existing user's access may be modified to make these tests pass.

Account erasure, hosted backup/Auth restore and physical device testing are unexecuted; do not count them as passing. The candidate migration remains pending explicit production approval.
