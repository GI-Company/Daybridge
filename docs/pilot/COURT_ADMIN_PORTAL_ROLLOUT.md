# DayBridge Court Admin Portal — staged rollout

**Status: Source-only candidate / not activated in production.**

This branch adds a semantic **Court Admin Portal** link inside the public landing page footer. It opens `/admin`, a separate route **within the same DayBridge application**, not a second app. The admin page contains three dependent dropdowns in this order: **State → Judicial Circuit → Court**, followed by staff username and password fields. The selected court builds the exact Supabase Auth alias **username@state.circuit.court**; a mismatched alias is refused. An authenticator-code second factor is required before admin account operations.

## Scope and privacy

Court staff can create temporary participant credentials, list assigned account usernames and status, count licensed seats, reset credentials, suspend or restore accounts, and remove a participant from the court-sponsored seat pool.

Court staff **cannot view** the participant's schedule, attendance, medications, notes, budgets, location history, or private snapshots from this dashboard. The server enforces court membership independently of the state/circuit selector. Unlisted courts do not appear in the public court directory. Administrative changes use a server-held service role; it is not available to browsers.

Existing personal users are not migrated or assigned to courts automatically. No records, accounts, Auth settings, or production tables were modified in this branch.

## Installation and required configuration

1. Create an **isolated staging Supabase project**, seed it with **synthetic** data, and test backup/restore. Do not first apply this migration to live production.
2. Review and then apply `supabase/migrations/20261103040000_daybridge_court_admin.sql` in staging. The migration seeds only a clearly fictional and isolated directory hierarchy: **Sample State (ZZ) → Sample Judicial Circuit → Sample Court (25 seats)**. No real staff identity or participant is seeded. All six new registry tables are private to the service role.
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set only as a protected **server-side** secret and never published as `NEXT_PUBLIC_` or included in client bundles.
4. Using trusted administrator tooling, create a staff Auth account using a court alias (for example, `admin@zz.samplecircuit.samplecourt`), confirm its identity through a secure human process, and enforce MFA. The staff member can enroll a TOTP factor on `/admin`. Do not create or infer actual staff accounts for this test.
5. In staging, after migration application, confirm the public directory shows **Sample State → Sample Judicial Circuit → Sample Court**. These are `daybridge_states`, `daybridge_judicial_circuits`, and `daybridge_courts` records joined using foreign keys. They have separate identities and constraints, not merely UI categories. A verified staff identity must be assigned to the sample court before any Auth account provisioning is allowed:

   ```sql
   -- STAGING ONLY. The operator must first verify the Auth identity.
   insert into public.daybridge_court_staff(court_id,user_id,role)
   select c.id,u.id,'coordinator'
   from public.daybridge_courts c
   join public.daybridge_judicial_circuits j on j.id=c.circuit_id
   join auth.users u on lower(u.email)='admin@zz.samplecircuit.samplecourt'
   where c.is_demo and c.login_slug='samplecourt'
     and j.login_slug='samplecircuit' and j.state_code='ZZ'
     and u.email_confirmed_at is not null;
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

## Adding real states, circuits, courts, and owner-assigned staff logins

State, judicial circuit and court dropdown options are **not hardcoded**: the API queries the registered Supabase hierarchy when the login page loads. Registering a new court means adding the related rows to `daybridge_states`, `daybridge_judicial_circuits`, and `daybridge_courts`; no UI source changes are needed.

Use the Supabase Table Editor or SQL Editor with trusted operator access. For example, in an approved environment:

```sql
insert into public.daybridge_states(code,name)
values ('GA','Georgia') on conflict (code) do nothing;

insert into public.daybridge_judicial_circuits(state_code,name,login_slug)
values ('GA','Enotah Judicial Circuit','enotah')
on conflict (state_code,name) do nothing;

insert into public.daybridge_courts(circuit_id,court_name,login_slug,seat_limit,subscription_plan,subscription_status,listed)
select id,'Example STAR Court','starcourt',25,'pilot','pilot',true
from public.daybridge_judicial_circuits
where state_code='GA' and login_slug='enotah'
on conflict (circuit_id,court_name) do nothing;
```

In **Supabase Authentication**, as an administrator, create and confirm `manager@ga.enotah.starcourt` with a strong password. This is a **non-deliverable internal alias**; do not expect email confirmation or password recovery messages to arrive. Establish a verified real-world contact and out-of-band reset procedure. Then, **only after verification**, execute:

```sql
insert into public.daybridge_court_staff(court_id,user_id,role)
select c.id,u.id,'coordinator'
from public.daybridge_courts c
join public.daybridge_judicial_circuits j on j.id=c.circuit_id
join auth.users u on lower(u.email)='manager@ga.enotah.starcourt'
where j.state_code='GA' and j.login_slug='enotah'
  and c.login_slug='starcourt' and u.email_confirmed_at is not null
on conflict (court_id,user_id) do update set active=true,role='coordinator';
```

This privileged SQL statement verifies the existing normalized hierarchy and links the confirmed Auth UUID to a single court. It must only run in the Supabase SQL Editor by the trusted project owner. An arbitrary email string can neither create a new court nor authorize itself. Reuse the known court ID for subscriptions and seats: `subscription_plan` and `subscription_status` live in `daybridge_courts` and are authoritative; the email is a human-readable identifier, **not** a subscription enforcement mechanism. The subscription gate currently prevents new account creation when a court is paused/canceled and does not charge money or automatically revoke participant data.

**The dropdowns do not populate merely by creating an Auth identity.** You must register the state/circuit/court in the database and link each verified staff Auth account to its court. Both steps are intentional security boundaries.

**Production test profile:** The operator-created `manager@ga.enotah.starcourt` account can be linked to a clearly labeled **DayBridge STAR Court Test** directory entry with `is_demo=true`, 25 seats, `subscription_plan='pilot'`, and `subscription_status='pilot'`. This label is a software testing workspace, **not an endorsement or a staff account of an actual court**. Do not onboard real participants until revocation, security testing, and consent workflows are verified.
