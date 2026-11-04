/**
 * Local session exit requires no unsubmitted form and either cloud sync or
 * an explicitly confirmed, durable encrypted device copy.
 * Signing out must never delete the encrypted device cache or cloud records.
 */
export type DayBridgeSyncStatus='synced'|'device_saved'|'local_only'|'syncing'|'offline';

export function signOutBlockReason(syncStatus:DayBridgeSyncStatus,hasUnsubmittedDraft:boolean,hasDurableDeviceCopy=false):string|null{
 if(hasUnsubmittedDraft)return 'Finish or close your unfinished form before signing out. Unsubmitted fields would be lost.';
 if(syncStatus!=='synced'&&!hasDurableDeviceCopy)return 'Your private records are not fully synced. Preserve an encrypted device copy before signing out.';
 return null;
}
