# Approved personal production release — 2026-10-24

The owner explicitly authorized the migration and main release after backup checks, with personal data survival to be tested in production. The prior institutional NO-GO assessment does not prohibit this specifically approved personal update; its enrollment/contract/device gates remain outstanding.

## Backup and migration evidence

- Before release, an RSA-4096/AES-256 encrypted logical archive captured records from all 26 public tables, Auth owner UUID references and public columns/policies/grants. No decrypted participant records were written to disk or Git.
- A separately stored private recovery key and archive have restrictive local permissions. In-memory decryption, SHA-256 and all table counts passed. This is record recovery verification, not full Supabase Auth/Vault/project PITR recovery.
- Local backup directory: `~/Documents/DayBridge Backups/2026-10-24-security-release`. Key custody/recovery instructions are in its restricted RECOVERY.md. Private backup values and digests are deliberately absent from this repository.
- `20261024040536_personal_security_baseline.sql` is the exact guarded SQL applied as `personal_security_baseline`. The original prepared file had version prefix 20261024031314; it was renamed to match the version assigned by the live migration service. Do not apply it again.
- The migration runs atomically, takes consistently ordered short-lived table locks, and aborts if any pre-existing public row count or SHA-256 digest changes. A deliberately destructive synthetic variant was rejected and fully rolled back in the disposable test.
- Both the atomic live guard and a separate immediate comparison passed: every record in all 26 pre-existing public tables was unchanged. The new audit table raises the public RLS table count to 27.
- Live privileges verified: authenticated owner-save enabled; anonymous save disabled; device registration service-only; browser push-key reads and history-sequence modification denied.
- Supabase advisor now retains only the pre-existing leaked-password-protection warning; its receipt-policy INFO is resolved. No password/provider setting, credential, paid plan or Auth identity was changed.

## Release and acceptance

The application and audit documents are being merged through the existing main Git integration for one production redeployment. No preview or separate CLI deployment is needed. The code retains the older save RPC/history for older clients and rollback. The feature branch's deployment guard is retained.

After the main deployment, verify exact `/api/version`, liveness, security headers and baseline record integrity. The owner will open the updated signed-in installed app to confirm their own appointments, medication history, budget, maps and saves. That personal-device acceptance is pending; no automated fixture is claimed as proof of it.

The local deployable app passed type checks, lint, 61 unit tests, a full 54-case production browser run and six final focused lock checks. The database suite now has 30 named groups, including migration data/schema rollback protection. Hosted CI remains blocked by a GitHub billing lock, not a passing remote run.

Historical migration sources are consolidated and do not map one-to-one to every older live migration timestamp. Do not blindly run a full CLI push/reset against this existing project. Apply only reviewed migrations with matched live history, explicit authorization and preservation evidence.
