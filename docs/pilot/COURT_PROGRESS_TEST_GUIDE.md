# Court progress test supplement

Use this supplement only in a disposable local or separately approved test environment with fictional accounts. Leave the initial pilot and its production court reporting flags disabled. These tests do not replace the existing owner > court > staff > participant > installed PWA onboarding guide.

## Prepare the isolated test

1. Apply the repository migrations to a disposable database, including `20261106184537_consented_court_progress.sql`. Do not apply it to production without approval. Use a separate test project for real hosted Auth verification; local automated tests use PGlite and simulated browser transport.
2. Use the existing owner flow to create Court A with 25 seats, its case manager, a colleague and two participants. Create Court B with a different case manager and participant. Complete all required first-password changes. Use separate browser profiles/devices per identity.
3. As Court A staff, open Participant Progress. Expect Reporting disabled, with no progress data. As participant A, open Settings & security > Sharing with My Court. All category switches must be off/disabled; no items are shared.
4. Check existing create/reset/suspend/restore account administration still works and staff consume no seats. With two participants, assigned seats remain two; reporting must never change the seat count.

## Enable a fictional demonstration only

5. In the test owner profile, select Court A under court management. In Voluntary participant reporting, choose Enable reporting after testing and confirm. Leave Court B disabled. The owner should see availability only; there must be no progress entries in the owner dashboard.
6. Refresh participant A's sharing settings. Availability is enabled, but all categories remain off and no entries exist in shared progress history. Merely enabling the court must publish nothing.
7. Privately create tomorrow's Court appointment with a distinctive test title and description, a Class appointment from yesterday, and a personal appointment. Add a medication, fictional bank balance, sticky note, contact and saved place with unique sentinel text. None of these private text or location values should appear in any staff reporting response.
8. Add a task. Choose Related court appointment > tomorrow's Court appointment, then save. Also create a general task with No court link. The court link alone must not publish either task.

## Consent and explicit item choice

9. Under Sharing with My Court, enable Court-program meetings and accept the confirmation. Staff reports must still be empty because no individual item has been selected.
10. Wait for private records to show Saved. Choose tomorrow's Court item, select Court-program meetings, leave the historical checkbox off, choose Share selected item and confirm. Staff should see the category and date as Upcoming, with no private title, description, address or location.
11. Mark the Court appointment attended using the existing private Court & Classes attendance action. Wait for Saved and refresh staff progress. Expect Self-reported complete, a reported time and self-report provenance. No official compliance judgment should appear.
12. Change attendance to not attended. Save and refresh. Expect Self-reported incomplete. Undo the private change through Settings, save and refresh; confirm the current report follows the actual restored private state. Clear or undo attendance fully and confirm a stale completion does not remain.
13. Enable Shared court obligations and explicitly select the linked task. Complete the task privately, save and refresh staff progress; expect self-reported complete. Undo task completion, save and refresh; expect Not self-reported/Upcoming as appropriate. General tasks must never be selectable.
14. For a generic court-program check-in, create a Court appointment, enable Court-program check-ins and explicitly select that item with this reporting category. Mark the appointment attended privately to report completion, then undo and verify correction. Existing drug-test check-in windows are deliberately excluded; do not use them as reporting tests.

## Explicit historical sharing

15. Enable Court-program classes. The class from yesterday must not appear automatically. Select it with future-only sharing; yesterday's entry still must not appear.
16. Separately check Include historical activity, choose a UTC date before the class, choose Share selected item and accept the historical confirmation. Staff should now see the selected class with Explicitly shared history provenance. No other older entries may appear.
17. Review shared progress and consent history as the participant. It should show only sanitized current shared states, withdrawal states and category consent changes. A history date outside the last year must be rejected.

## Staff reporting and privacy checks

18. As Court A staff, choose Participant Progress. Test All participants, a specific username, category filters, Last 7 days, This month and a custom range. From/Through filters use UTC and Through is inclusive in the interface. The maximum is 93 days.
19. Check participant username/account status, permitted categories, last reported activity, details and weekly/monthly aggregates. Do not compare counts to all organizer obligations: unshared and unknown data are excluded. A participant with sharing off must display Sharing disabled, never a violation. Empty filters must display Not enough information.
20. In browser network tools, inspect `/api/admin/progress` responses. Check every sentinel from step 7 is absent. Titles, descriptions, medication adherence, financial values, notes, contacts, coordinates, organizer source IDs and credentials must be absent. Only approved report fields are permitted.
21. Through a trusted test database administrator, confirm every successful enabled staff read creates a report-access audit row with actor, court, selected subject/period/category and timestamp. Do not give staff raw database access to inspect this.
22. Sign in as Court B staff and attempt Court A's progress URL/API with Court A's ID. Expect 403. Reverse the courts and repeat. Attempt another participant's ID in Court A's query: expect 403. Try anonymous and participant sessions on the staff endpoint: expect denial.
23. Try the staff report endpoint as owner, including an owner deliberately also assigned staff membership in an isolated fixture. Expect denial. The owner availability endpoint must still return only enabled/disabled, never reports.
24. Using authenticated browser-role database sessions, attempt SELECT/INSERT/UPDATE on reporting tables and direct reporting RPC execution. Expect permission denial. These checks are automated in the disposable database tests; no browser role gets a service key.

## Withdrawal and employment lifecycle

25. As participant A, disable a sharing category. Confirm its staff-visible entries disappear and future edits do not publish. The participant should retain withdrawn current states and consent history. Re-enable the category; nothing may resume until individual items are selected again.
26. Stop sharing one item. Save/refresh, verify its report is withdrawn. Delete another selected private source or remove its court eligibility and save; staff must not retain a completion. Confirm private records not targeted by the deletion remain unchanged. Change a selected appointment time/recurrence or task due date/court link: expect withdrawal and a participant review notice; sharing must not resume until the item is explicitly selected again.
27. As owner, revoke one Court A staff member. The revoked session's next protected report request must fail and clear the report. The colleague should continue to have access. Check the revoked person's earlier report-access audit is retained. Reset a staff password and verify old sessions are rejected until the existing first-password-change/current-session flow completes.
28. Suspend participant A through existing admin actions. Reporting must disappear, consent end and the occupied seat remain. Restore: the personal workspace remains, but fresh consent and item selection are required. Remove a fictional participant only at the end: the seat is freed, reports disappear, identity and personal records remain under the existing access lifecycle.
29. Disable Court A reporting availability. The staff screen should show disabled, consent should end and no later private activity should publish. Re-enable in the isolated test only and verify no selection/consent resumes. Repeat court disable/restore; reporting must remain withdrawn until fresh consent.
30. End the demonstration by leaving availability disabled. Keep test audit records; do not delete real accounts or modify the production court.

## Device and failure checks

31. Repeat the participant and staff screens on desktop, a tablet-width window and an actual installed participant PWA. Check wrapping, readable controls, keyboard focus, checkbox labels and no horizontal overflow.
32. In a test participant session, disconnect the network before correcting shared attendance. The existing device queue should retain the private edit; staff may still see the last cloud state while disconnected. Reconnect, wait for Saved and refresh staff. The correction must apply atomically. Do not treat offline device edits as delivered reports.
33. Simulate a failed report-access audit write on an isolated database. The report must fail closed without returning progress. Simulate malformed or unauthorized API payloads and confirm generic errors reveal no private content. Never alter production audit settings for a test.
34. Repeat the original end-to-end onboarding guide and 25-seat capacity checks. Reporting off must not alter credentials, force-password-change behavior, installation, private saving, reminders or interactive maps.

## Record acceptance

For each step, record tester/date/device, expected result, observed result, Pass/Fail/Blocked/Not run, and issue ID. Keep credentials out of evidence. A production launch requires explicit approval, hosted test evidence, privacy/retention review and no unresolved access-isolation failures. Do not treat synthetic browser screenshots or local database tests as hosted-service evidence.
