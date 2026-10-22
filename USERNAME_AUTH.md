# Admin-only username and password accounts for DayBridge

DayBridge's sign-in screen accepts **username + password**. There is no self-registration UI, and new authentication accounts must be created by the Supabase project administrator.

## Important: how Supabase Auth works

Supabase Auth requires an email or phone for password sign-in; it does **not** natively sign in directly with a username. DayBridge uses a **non-deliverable internal email alias** solely as the Auth identifier:

```
username: taylor_01
auth email: taylor_01@accounts.daybridge.example.com
```

Users enter only `taylor_01` and their password in DayBridge. The browser client computes the alias before calling Supabase's normal `auth.signInWithPassword`. Password hashing, rate limiting and sessions remain Supabase Auth's responsibility. No admin/secret key is shipped to browsers and no public username lookup exists.

The suffix is a constant in `lib/auth/username.ts`. Do not alter it or rename an existing user's Auth email without an account migration. Valid usernames are **3–32** characters, begin with a letter, and otherwise use letters, digits, underscores or hyphens. They are case-insensitive.

## Required: disable public registration

In the **Daybridge** Supabase project, visit **Authentication → Sign In / Providers → Auth configuration** (label may differ by dashboard version). Disable **Allow new users to sign up**. Also disable **anonymous sign-ins**. Keep Email password authentication enabled for the internal aliases. These settings are required to enforce that accounts must be created by an administrator. Merely hiding the sign-up button would not prevent direct API registrations.

**Do not disable the Email authentication provider itself**, because Supabase still uses the aliases as email/password Auth identities. If you use an app-level global auth setting on another Supabase project, leave that project untouched.

## Creating a username account

1. Open **Supabase → Daybridge → Authentication → Users → Add user → Create new user**. Do not choose **Send invitation**, since the alias is not a real mailbox.
2. Choose a username, e.g. `taylor_01`. Use the exact generated email `taylor_01@accounts.daybridge.example.com` for the required Auth email field.
3. Generate a unique, strong password (prefer at least 16 characters). Create the user with **Auto Confirm User** enabled, where supported, so login does not require an impossible email confirmation. The server-side Auth Admin API also supports `createUser({ email, password, email_confirm: true })`. If the dashboard no longer exposes auto-confirm, use a trusted admin-only server environment; do not place the service key in DayBridge's frontend.
4. Give the user **only** their username and temporary password through a private channel. Never log or email plaintext passwords.
5. They install DayBridge, enter the username/password, and can use **Settings → Change password** to replace the temporary password. Optional passkey enrollment remains available after a successful login.

**There is currently no self-service email password reset for these accounts.** Admin resets should use the Supabase Auth management dashboard or `auth.admin.updateUserById` in a trusted admin environment. Set expectations before issuing accounts.

## Verification checklist

- Disable public sign-up; direct Auth `signUp` requests must be rejected.
- Verify only an admin-created, confirmed alias account can sign in with username/password.
- Verify nonexistent usernames and bad passwords return the same generic sign-in error.
- Verify uppercase inputs normalize to lowercase.
- Verify a user's existing owner-only RLS records remain isolated from other accounts.
- Test device passkeys and current-password-required password change.
- Keep passwords and Supabase service keys out of GitHub, logs, and chat.

No database migration is necessary. Existing Supabase `auth.users` and user-scoped RLS records are used unchanged.
