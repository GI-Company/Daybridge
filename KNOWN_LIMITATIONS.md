# Verified limitations

The current personal app and the isolated security candidate are distinct releases. Branch improvements are not deployed. See [candidate readiness](docs/pilot/PILOT_TECHNICAL_READINESS.md).

1. Whole-account snapshot synchronization uses revision checks and encrypted device staging. Conflicts preserve local edits and stop overwrites; automatic merge and independent deletion tombstones are unavailable. A lost successful response may require manual reconciliation.
2. Offline access requires an already loaded shell/device cache and an unexpired cached session. New login and unlocking the optional device lock require internet. Origin changes, clearing storage, browser eviction or device loss can remove unsynced data. Encryption keys share the browser origin.
3. Scheduled reminders/traffic checks are implemented, with retries and provider receipts. Exact device-visible delivery is not guaranteed. OS display, quiet hours, network, permissions and app installation matter. Alerts never establish medication/attendance completion.
4. Real installed iPhone/iPad, Android and signed-in macOS candidate acceptance is pending. Chromium mobile emulation is not physical-device proof. Passkeys are experimental and project/domain dependent.
5. Interactive maps require WebGL2, network, valid TomTom configuration and authentication. No static fallback or fabricated road geometry is used. Closed-app travel uses an approved saved origin, not continuous background GPS.
6. Legacy usernames use non-deliverable aliases with no self-service email recovery. Secure new username provisioning, administrator MFA and recovery ceremony need verification before pilot enrollment. Existing accounts remain unchanged.
7. Exported JSON is unencrypted. History retains earlier data; complete account deletion, retention purge and general import/restore UI are unavailable. Hosted project/Auth recovery remains unverified despite successful disposable database restore tests.
8. Unused normalized domain tables are not populated by the shipped snapshot UI. The pending security migration restricts their browser grants without removing rows; external integrations need review before access changes.
9. Application audit is incomplete for reads/admin access. Signup configuration, password protections, operational alerting, 30-account load and hosted multi-connection JWT tests are release gates. Existing CI account billing can prevent remote jobs.
10. Accessibility on VoiceOver/TalkBack, native dialogs, reduced motion and physical-device zoom needs acceptance testing. The app remains a personal organization aid, not an emergency service, medical device or official court verification system.
