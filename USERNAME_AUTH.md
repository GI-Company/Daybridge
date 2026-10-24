# Authentication and provisioning status

> Release update 2026-10-24: production migration and record-preservation checks have passed following owner approval. See [release status](docs/pilot/PRODUCTION_RELEASE_2026-10-24.md). Earlier candidate-state descriptions below are retained as the audit history.

Existing accounts are preserved. DayBridge accepts existing real email/password credentials and legacy assigned usernames. Supabase owns password hashing, refresh/session behavior and provider rate limits. No public privileged authentication API is exposed by the PWA.

## Existing username compatibility

The client maps an existing username through `lib/auth/username.ts` to a non-deliverable internal Auth alias. This is compatibility code, **not an approved new pilot provisioning mechanism**. Changing its suffix or an existing Auth email without a reviewed identity migration would break access. Do not rename/recreate existing users or change their UUIDs during deployment.

Legacy aliases have no mailbox or self-service email recovery. An administrator can manage them using trusted Supabase tooling, but must verify identity through an approved private process, avoid storing/logging/transmitting plaintext initial credentials insecurely, and audit sensitive administration. No live account or password was changed for this branch.

## Before provisioning new pilot participants

1. Verify public signup and anonymous Auth are disabled at Supabase, while preserving password authentication for existing accounts. These settings were not changed in this work; UI absence is not enforcement.
2. Require MFA for infrastructure/Auth administrators and establish recovery/break-glass custody. No court-staff record permissions are implied by account administration.
3. Design/test an initial credential process with a verified recovery channel, short-lived one-time enrollment, first-use credential choice, allowed redirects and revocation. Existing email/password sign-in works; an app invitation/recovery callback and secure username directory/provisioning workflow are not yet implemented or verified. Do not improvise new synthetic-email shortcuts or claim temporary passwords are forced to rotate by current code.
4. Use only isolated synthetic accounts to verify invalid credentials, real signed/expired/forged tokens, refresh, logout, lost-device revocation and administrative denial. See [RLS test boundaries](docs/pilot/SUPABASE_RLS_TEST_REPORT.md).
5. Obtain approval before production Auth settings, credentials or existing-user access changes. Keep service keys out of browsers, Git, logs and participant exports.

Settings permits an existing authenticated participant to change a password. Passkeys remain experimental/provider dependent. The candidate adds manual and opt-in inactivity lock with online password verification; that lock preserves mounted drafts and does not independently encrypt or wipe records.
