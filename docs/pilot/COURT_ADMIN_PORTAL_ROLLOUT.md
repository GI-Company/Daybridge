# DayBridge Court Admin Portal — staged rollout

**Status: Source-only candidate / not activated in production.**

This branch adds a semantic **Court Admin Portal** link inside the public landing page footer. It opens `/admin`, a separate route **within the same DayBridge application**, not a second app. The admin page contains three dependent dropdowns in this order: **State → Judicial Circuit → Court**, followed by staff username/email and password fields. An authenticator-code second factor is required before admin account operations.

## Scope and privacy

Court staff can create temporary participant credentials, list assigned account usernames and status, count licensed seats, reset credentials, suspend or restore accounts, and remove a participant from the court-sponsored seat pool.

Court staff **cannot view** the participant's schedule, attendance, medications, notes, budgets, location history, or private snapshots from this dashboard. The server enforces court membership independently of the state/circuit selector. Unlisted courts do not appear in the public court directory. Administrative changes use a server-held service role; it is not available to browsers.

Existing personal users are not migrated or assigned to courts automatically. No records, accounts, Auth settings, or production tables were modified in this branch.

## Installation and required configuration

1. Create an **isolated staging Supabase project**, seed it with **synthetic** data, and test backup/restore. Do not first apply this migration to live production.
2. Review and then apply `supabase/migrations/20261103040000_daybridge_court_admin.sql` in staging. The migration seeds only a clearly fictional and isolated directory hierarchy: **Sample State (ZZ) → Sample Judicial Circuit → Sample Court (25 seats)**. No real staff identity or participant is seeded. All six new registry tables are private to the service role.
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set only as a protected **server-side** secret and never published as `NEXT_PUBLIC_` or included in client bundles.
4. Using trusted administrator tooling, create a verified staff Auth account with a working recovery email and enforce MFA. The staff member can enroll a TOTP factor on `/admin`. Do not create or infer actual staff accounts for this test.
5. In staging, after migration application, confirm the public directory shows **Sample State → Sample Judicial Circuit → Sample Court**. These are `daybridge_states`, `daybridge_judicial_circuits`, and `daybridge_courts` records joined using foreign keys. They have separate identities and constraints, not merely UI categories. A verified staff identity must be assigned to the sample court before any Auth account provisioning is allowed:

   ```sql
   -- STAGING ONLY: requires a verified staff Auth user UUID.
   insert into public.daybridge_court_staff(court_id,user_id,role)
   select id,'<verified-staff-user-id>'::uuid,'coordinator'
   from public.daybridge_courts
   where court_name='Sample Court' and is_demo=true;
   ```

   Once staff sign in with MFA, the portal's **Create sample account** action uses `supabase.auth.admin.createUser` to create a **real Supabase Auth test account** and assigns it a seat in the Sample Court in a protected database transaction. The temporary password must be delivered securely and changed at first login. There are **no default shared admin credentials or pre-created participants**. The production Supabase database remains untouched unless staging passes and a separate rollout is approved.

6. Run `npm run test:db` (now includes the three-court database test), then test at least **three different synthetic courts** with separate staff and participants, 25-seat capacity races, forged IDs, swapped circuit, staff revocation, AAL1 vs AAL2, bad tokens, password reset, and wrong-court denial.
7. Verify password rotation on first sign-in, plus restore and suspension workflows using genuine signed sessions. Test against actual mobile browsers and PWAs.
8. Assess enrollment, secure credential handoff, lost-device recovery, data retention/erasure, court contracts, security incident ownership, and applicability of HIPAA/Part 2 or other privacy duties before real enrollment.

## Important release blockers

- **Not yet safe to onboard real institutional participants:** A hosted security/penetration test and performance test have not been completed. Automated checks supplied in the branch are structural checks only.
- The current login still supports username aliases using a synthetic non-deliverable email domain. These are compatible with existing logins, but **have no direct email-based password recovery**. A case-manager-assisted identity verification and secure handoff procedure must be reviewed; ideally implement a verified recovery channel.
- The admin API's suspension/removal uses the Supabase Auth ban feature and an online managed-account gate. **It does not instantly revoke every already-issued JWT or erase offline cached data**. Existing valid tokens may continue to access underlying Supabase APIs until expiry; add and test server/database-level managed-user revocation before presenting "instant access removal" as a security guarantee.
- **No bulk users, public signup, staff account creation, participant record viewing, court billing or pricing gates** were added. Only GIC staff with trusted administration access should initially approve circuits and case managers.
- Account creation performs Auth creation followed by a database seat transaction; failures attempt rollback. Race/retry/orphan reconciliation must be tested with synthetic users before use.
- Preserve existing records, migrations, preview/production secrets, and working personal-user sessions; obtain explicit approval before altering the production project.
- Court-staff access requires an Auth MFA AAL2 session. The optional five-minute participant idle lock remains **optional and unchanged**.
- `/admin` is not subject to the PWA installation gate; participant workflows remain where they are.
- The portal is **not** a court case-management system and cannot verify compliance.

## Proposed review gates

- `npm run typecheck`, `npm run lint`, `npm test`, and production build all pass in a reviewed CI run.
- Three-court adversarial integration tests pass in staging; no cross-court data leakage.
- Audit event logs and service-role restrictions are verified with actual Supabase roles.
- Staff training, secure credential handoff, recovery, deprovisioning and support documentation are approved.
- A demo involving fictional participants is accepted before any institutional invitation.

**Never seed actual court staff membership or deploy production Auth changes without verified authorization.** The sample court can create real Auth test accounts only once a trusted staff identity has been linked, protected secrets configured, and the database migration deployed to the intended environment.
