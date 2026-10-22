/**
 * DayBridge personal edition uses admin-provisioned Supabase Auth accounts.
 * Supabase Auth password sign-in requires an email or phone internally.
 * This deterministic, non-deliverable email alias lets the user enter only
 * their assigned username. The alias is not a mailbox or recovery channel.
 *
 * Changing this suffix breaks sign-in for all provisioned accounts; migration
 * requires updating the corresponding Auth identities in Supabase.
 */
export const AUTH_ALIAS_DOMAIN = 'accounts.daybridge.example.com';
export const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{2,31}$/;

export function normalizedUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameToAuthEmail(value: string): string | null {
  const username = normalizedUsername(value);
  return USERNAME_PATTERN.test(username)
    ? `${username}@${AUTH_ALIAS_DOMAIN}`
    : null;
}
