import type {BudgetAccount} from './types';

/** Applies a signed manual ledger entry to one verified active account. */
export function applyAccountMovement(
 accounts:BudgetAccount[],accountId:string,amountCents:number,recordedAt:string
):BudgetAccount[]{
 if(!Number.isSafeInteger(amountCents)||amountCents===0)throw new Error('Invalid ledger amount');
 if(!accounts.some(account=>account.id===accountId&&account.isActive))
  throw new Error('No active account selected');
 return accounts.map(account=>{
  if(account.id!==accountId)return account;
  const balance=account.balanceCents+amountCents;
  if(!Number.isSafeInteger(balance))throw new Error('Account balance overflow');
  return {...account,balanceCents:balance,lastConfirmedAt:recordedAt};
 });
}
