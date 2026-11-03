/**
 * An account can end its current session only after all private changes are
 * cloud-synced and no form has an unsubmitted draft.
 * Signing out must never delete the encrypted device cache or cloud records.
 */
export type DayBridgeSyncStatus='synced'|'device_saved'|'local_only'|'syncing'|'offline';

export function signOutBlockReason(syncStatus:DayBridgeSyncStatus,hasUnsubmittedDraft:boolean):string|null{
 if(hasUnsubmittedDraft)return 'Finish or close your unfinished form before signing out. Unsubmitted fields would be lost.';
 if(syncStatus!=='synced')return 'Your private records are not fully synced to Supabase. Keep DayBridge open and use Sync now before signing out.';
 return null;
}
