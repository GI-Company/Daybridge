import {
  BudgetAccount,
  Bill,
  BudgetReserve,
  SafeToSpendResult,
  RemainingPaycheckResult,
  WageAdvance,
  PaycheckPlan,
} from './types';

/**
 * Format integer cents into a standard currency string (e.g. 15000 -> "$150.00")
 */
export function formatCents(cents: number): string {
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainingCents = absCents % 100;
  const formatted = `$${dollars.toLocaleString()}.${remainingCents.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parses user input dollars into integer cents safely without float drift.
 * e.g. "12.50" -> 1250, "12" -> 1200, "-5.25" -> -525
 */
export function parseDollarsToCents(val: string | number): number {
  if (typeof val === 'number') {
    return Math.round(val * 100);
  }
  const clean = val.replace(/[^0-9.-]/g, '');
  if (!clean || isNaN(Number(clean))) return 0;
  const parts = clean.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  const sign = clean.startsWith('-') ? -1 : 1;
  const fractional = parts[1] ? (parts[1] + '00').slice(0, 2) : '00';
  const fracNum = parseInt(fractional, 10);
  return (Math.abs(whole) * 100 + fracNum) * sign;
}

/**
 * Calculate conservative Safe-to-Spend in pure integer cents.
 * 
 * Rules:
 * 1. Sum up all confirmed liquid accounts (checking, cash, prepaid). Do NOT add pending or unconfirmed paychecks.
 * 2. Deduct unpaid bills due before or on the next payday.
 * 3. Deduct essential earmarked reserves (gas, food, prescriptions, etc.).
 * 4. Deduct user's emergency safety buffer.
 * 5. Net spendable is clipped to $0 minimum so user never thinks they have spendable cash when in deficit.
 * 6. If negative, shortfallCents records the deficit needed to break even.
 */
export function calculateSafeToSpend({
  accounts,
  bills,
  reserves,
  nextPayday,
  emergencyBufferCents = 1000,
}: {
  accounts: BudgetAccount[];
  bills: Bill[];
  reserves: BudgetReserve[];
  nextPayday?: string;
  emergencyBufferCents?: number;
}): SafeToSpendResult {
  // Aggregate liquid balance
  const activeLiquidAccounts = accounts.filter(
    (a) => a.isActive && (a.accountType === 'checking' || a.accountType === 'cash' || a.accountType === 'prepaid')
  );
  const totalConfirmedCents = activeLiquidAccounts.reduce((sum, a) => sum + a.balanceCents, 0);

  // Check for stale account snapshots (> 7 days without user confirmation)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const staleAccountWarning = activeLiquidAccounts.some(
    (a) => new Date(a.lastConfirmedAt).getTime() < sevenDaysAgo.getTime()
  );

  // Calculate days until next payday
  let daysUntilPayday = 7;
  let targetPaydayDate: Date | null = null;
  if (nextPayday) {
    targetPaydayDate = new Date(`${nextPayday}T23:59:59`);
    const diffMs = targetPaydayDate.getTime() - now.getTime();
    daysUntilPayday = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Unpaid bills due before next payday
  const unpaidPrePaydayBills = bills.filter((b) => {
    if (b.isPaid) return false;
    if (!targetPaydayDate) return true; // if no payday specified, treat pending bills as upcoming
    const billDueDate = new Date(`${b.nextDueDate}T23:59:59`);
    return billDueDate.getTime() <= targetPaydayDate.getTime();
  });
  const unpaidPrePaydayBillsCents = unpaidPrePaydayBills.reduce((sum, b) => sum + b.amountCents, 0);

  // Earmarked essential reserves
  const essentialReserves = reserves.filter((r) => r.isEssential);
  const earmarkedReservesCents = essentialReserves.reduce((sum, r) => sum + r.allocatedCents, 0);

  // Raw available cents before clipping
  const rawAvailableCents = totalConfirmedCents - unpaidPrePaydayBillsCents - earmarkedReservesCents - emergencyBufferCents;

  const netSpendableCents = Math.max(0, rawAvailableCents);
  const shortfallCents = rawAvailableCents < 0 ? Math.abs(rawAvailableCents) : 0;

  return {
    totalConfirmedCents,
    unpaidPrePaydayBillsCents,
    earmarkedReservesCents,
    emergencyBufferCents,
    netSpendableCents,
    shortfallCents,
    isEstimated: staleAccountWarning,
    staleAccountWarning,
    daysUntilPayday,
  };
}

/**
 * Calculates remaining net paycheck when wage advances have been drawn.
 * Never counts both advance and original full paycheck as spendable cash.
 */
export function calculateRemainingPaycheck({
  paycheckPlan,
  advances,
}: {
  paycheckPlan: PaycheckPlan | null;
  advances: WageAdvance[];
}): RemainingPaycheckResult {
  if (!paycheckPlan) {
    return {
      expectedNetCents: 0,
      totalAdvancesCents: 0,
      totalFeesCents: 0,
      netRemainingCents: 0,
      overadvancedCents: 0,
    };
  }

  // Unreconciled advances for this pay cycle
  const activeAdvances = advances.filter(
    (adv) => !adv.isReconciled && (!adv.paycheckPlanId || adv.paycheckPlanId === paycheckPlan.id)
  );

  const totalAdvancesCents = activeAdvances.reduce((sum, adv) => sum + adv.advanceAmountCents, 0);
  const totalFeesCents = activeAdvances.reduce((sum, adv) => sum + adv.feeCents, 0);

  const totalDeductionsCents = totalAdvancesCents + totalFeesCents;
  const rawRemainingCents = paycheckPlan.expectedNetCents - totalDeductionsCents;

  const netRemainingCents = Math.max(0, rawRemainingCents);
  const overadvancedCents = rawRemainingCents < 0 ? Math.abs(rawRemainingCents) : 0;

  return {
    expectedNetCents: paycheckPlan.expectedNetCents,
    totalAdvancesCents,
    totalFeesCents,
    netRemainingCents,
    overadvancedCents,
  };
}
