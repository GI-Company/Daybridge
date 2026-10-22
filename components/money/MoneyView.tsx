'use client';

import React, { useState } from 'react';
import {
  Wallet,
  DollarSign,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import {
  calculateSafeToSpend,
  calculateRemainingPaycheck,
  formatCents,
  parseDollarsToCents,
} from '../../lib/budget';
import { formatDate } from '../../lib/date-time';

interface MoneyViewProps {
  onOpenQuickAdd: () => void;
}

export const MoneyView: React.FC<MoneyViewProps> = ({ onOpenQuickAdd }) => {
  const {
    accounts,
    updateAccountBalance,
    transactions,
    deleteTransaction,
    paycheckPlan,
    updatePaycheckPlan,
    advances,
    addAdvance,
    bills,
    markBillPaid,
    reserves,
    updateReserve,
    profile,
  } = useDayBridge();

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newBalanceInput, setNewBalanceInput] = useState<string>('');

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmountInput, setAdvanceAmountInput] = useState('100.00');
  const [advanceFeeInput, setAdvanceFeeInput] = useState('3.99');
  const [advanceNotesInput, setAdvanceNotesInput] = useState('Earned wage access');

  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [actualNetInput, setActualNetInput] = useState('750.00');

  // Safe to spend calculation
  const safeToSpend = calculateSafeToSpend({
    accounts,
    bills,
    reserves,
    nextPayday: paycheckPlan?.nextPayday,
    emergencyBufferCents: profile.emergencyBufferCents,
  });

  // Paycheck remaining calculation (advances deducted)
  const remainingPaycheck = calculateRemainingPaycheck({
    paycheckPlan,
    advances,
  });

  const handleUpdateBalance = (accountId: string) => {
    const cents = parseDollarsToCents(newBalanceInput);
    updateAccountBalance(accountId, cents);
    setEditingAccountId(null);
  };

  const handleRecordAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseDollarsToCents(advanceAmountInput);
    const feeCents = parseDollarsToCents(advanceFeeInput);
    if (!amountCents) return;

    addAdvance({
      paycheckPlanId: paycheckPlan?.id,
      advanceAmountCents: amountCents,
      feeCents,
      receivedDate: new Date().toISOString().split('T')[0],
      isReconciled: false,
      notes: advanceNotesInput.trim(),
    });

    setShowAdvanceModal(false);
  };

  const handleReconcilePaycheck = (e: React.FormEvent) => {
    e.preventDefault();
    const actualCents = parseDollarsToCents(actualNetInput);
    if (!paycheckPlan) return;

    updatePaycheckPlan({
      actualNetCents: actualCents,
      reconciledAt: new Date().toISOString(),
    });

    setShowReconcileModal(false);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Title & Quick Add */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Money & Safe-to-Spend</h2>
          <p className="text-xs text-slate-600">
            Manual cashflow ledger, wage advance protection, and conservative availability
          </p>
        </div>
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-100/70"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Entry</span>
        </button>
      </div>

      {/* 1. SAFE-TO-SPEND HERO CARD */}
      <section className="bg-gradient-to-br from-teal-50 to-white border border-teal-500/30 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-teal-700">
              Conservative Safe-to-Spend
            </span>
            {safeToSpend.staleAccountWarning && (
              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Estimate — verify account</span>
              </span>
            )}
          </div>
          <span className="text-xs text-slate-600 font-medium">
            Next Payday: {paycheckPlan ? formatDate(paycheckPlan.nextPayday) : 'Not set'} (
            {safeToSpend.daysUntilPayday}d)
          </span>
        </div>

        <div className="mb-4">
          <div className="text-4xl sm:text-5xl font-extrabold text-teal-700 tracking-tight">
            {formatCents(safeToSpend.netSpendableCents)}
          </div>
          {safeToSpend.shortfallCents > 0 && (
            <div className="text-xs font-bold text-rose-700 mt-1">
              Shortfall of -{formatCents(safeToSpend.shortfallCents)} to cover pre-payday obligations
            </div>
          )}
        </div>

        {/* Breakdown details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-slate-200 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 block mb-0.5">Confirmed Cash</span>
            <span className="font-bold text-slate-800">
              {formatCents(safeToSpend.totalConfirmedCents)}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 block mb-0.5">Pre-Payday Bills</span>
            <span className="font-bold text-amber-800">
              -{formatCents(safeToSpend.unpaidPrePaydayBillsCents)}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 block mb-0.5">Essential Reserves</span>
            <span className="font-bold text-slate-700">
              -{formatCents(safeToSpend.earmarkedReservesCents)}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 block mb-0.5">Emergency Buffer</span>
            <span className="font-bold text-slate-700">
              -{formatCents(safeToSpend.emergencyBufferCents)}
            </span>
          </div>
        </div>
      </section>

      {/* 2. CONFIRMED ACCOUNT BALANCES (MANUAL LEDGER) */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Account Balances (Manual)</h3>
            <p className="text-xs text-slate-600">
              Confirm balances regularly; never requires bank credentials
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-semibold text-slate-700 block">{acc.name}</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCents(acc.balanceCents)}
                </span>
                <span className="text-[10px] text-slate-600 block">
                  Confirmed: {formatDate(acc.lastConfirmedAt)}
                </span>
              </div>

              {editingAccountId === acc.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 bg-white border border-teal-500 px-2 py-1 text-sm rounded text-slate-900"
                    placeholder="0.00"
                    value={newBalanceInput}
                    onChange={(e) => setNewBalanceInput(e.target.value)}
                  />
                  <button
                    onClick={() => handleUpdateBalance(acc.id)}
                    className="px-2.5 py-1 bg-teal-500 text-slate-950 font-bold text-xs rounded hover:bg-teal-400"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingAccountId(null)}
                    className="text-xs text-slate-600 hover:text-slate-800"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingAccountId(acc.id);
                    setNewBalanceInput((acc.balanceCents / 100).toFixed(2));
                  }}
                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs flex items-center gap-1 min-h-[44px]"
                  title="Update balance manually"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Update</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. PAYCHECK PLAN & WAGE ADVANCE PROTECTION */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Paycheck & Wage Advance Plan</h3>
            <p className="text-xs text-slate-600">
              Deducts advances from expected paycheck; avoids double-counting spendable cash
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdvanceModal(true)}
              data-daybridge-edit-button="true" className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 border border-slate-300 min-h-[44px]"
            >
              + Record Advance
            </button>
            <button
              onClick={() => setShowReconcileModal(true)}
              className="px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-800 border border-teal-500/30 hover:bg-teal-500/30 text-xs font-bold min-h-[44px]"
            >
              Reconcile
            </button>
          </div>
        </div>

        {paycheckPlan && (
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <span className="text-[11px] text-slate-600 block mb-0.5">
                  Expected Net Paycheck
                </span>
                <span className="text-xl font-bold text-slate-900">
                  {formatCents(remainingPaycheck.expectedNetCents)}
                </span>
                <span className="text-[10px] text-slate-600 block">
                  Next payday: {formatDate(paycheckPlan.nextPayday)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-600 block mb-0.5">
                  Advances Drawn (Deducted)
                </span>
                <span className="text-xl font-bold text-amber-700">
                  -{formatCents(remainingPaycheck.totalAdvancesCents + remainingPaycheck.totalFeesCents)}
                </span>
                <span className="text-[10px] text-slate-600 block">
                  {advances.filter((a) => !a.isReconciled).length} active advance(s)
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-600 block mb-0.5">
                  Remaining Expected on Payday
                </span>
                <span className="text-xl font-bold text-teal-700">
                  {formatCents(remainingPaycheck.netRemainingCents)}
                </span>
                {remainingPaycheck.overadvancedCents > 0 && (
                  <span className="text-[10px] text-rose-700 font-bold block">
                    Overadvanced by {formatCents(remainingPaycheck.overadvancedCents)}!
                  </span>
                )}
              </div>
            </div>

            {/* Active Advances List */}
            {advances.filter((a) => !a.isReconciled).length > 0 && (
              <div className="pt-3 border-t border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  Pending Paycheck Advances
                </span>
                <div className="space-y-2">
                  {advances
                    .filter((a) => !a.isReconciled)
                    .map((adv) => (
                      <div
                        key={adv.id}
                        className="flex items-center justify-between p-2.5 bg-white rounded-xl text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-800">
                            {formatCents(adv.advanceAmountCents)} advance
                          </span>
                          {adv.feeCents > 0 && (
                            <span className="text-slate-600 ml-2">
                              (+{formatCents(adv.feeCents)} fee)
                            </span>
                          )}
                          <span className="text-slate-600 text-[11px] block">{adv.notes}</span>
                        </div>
                        <span className="text-slate-600 text-[11px]">{adv.receivedDate}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. BILLS DUE BEFORE PAYDAY */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recurring Bills</h3>
            <p className="text-xs text-slate-600">
              Track due dates and mark paid to record corresponding expense safely
            </p>
          </div>
          <button
            onClick={onOpenQuickAdd}
            className="text-xs text-teal-700 hover:text-teal-800 font-medium"
          >
            + Add Bill
          </button>
        </div>

        <div className="space-y-2.5">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                bill.isPaid
                  ? 'bg-slate-50 border-slate-200 opacity-60'
                  : 'bg-slate-50/90 border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">{bill.title}</span>
                  {bill.isAutopay && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-800/60">
                      Autopay
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  Due: {formatDate(bill.nextDueDate)} • Amount: {formatCents(bill.amountCents)}
                </div>
              </div>

              <div>
                {bill.isPaid ? (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Paid</span>
                  </span>
                ) : (
                  <button
                    onClick={() => markBillPaid(bill.id, true)}
                    className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-950/40"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. EARMARKED RESERVES */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="mb-3">
          <h3 className="font-bold text-slate-900 text-base">Earmarked Reserves</h3>
          <p className="text-xs text-slate-600">
            Money set aside for essentials so you don&apos;t accidentally spend it
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reserves.map((res) => (
            <div key={res.id} className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-xs text-slate-800">{res.name}</span>
                <span className="font-bold text-sm text-teal-700">
                  {formatCents(res.allocatedCents)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateReserve(res.id, Math.max(0, res.allocatedCents - 500))}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-100 text-xs text-slate-700 min-h-[36px]"
                >
                  -$5
                </button>
                <button
                  onClick={() => updateReserve(res.id, res.allocatedCents + 500)}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-100 text-xs text-slate-700 min-h-[36px]"
                >
                  +$5
                </button>
                <span className="text-[11px] text-slate-600 ml-auto">
                  Target: {formatCents(res.targetCents)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. RECENT TRANSACTIONS LEDGER */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Transaction Ledger</h3>
            <p className="text-xs text-slate-600">Recent manual expenses and income entries</p>
          </div>
          <button
            onClick={onOpenQuickAdd}
            className="text-xs text-teal-700 hover:text-teal-800 font-medium"
          >
            + Add Transaction
          </button>
        </div>

        {transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.slice(0, 10).map((tx) => {
              const isIncome = tx.amountCents > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isIncome
                          ? 'bg-emerald-500/20 text-emerald-800'
                          : 'bg-rose-500/20 text-rose-800'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-slate-800 block">
                        {tx.notes || tx.category}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {formatDate(tx.transactionDate)} • {tx.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`font-bold text-sm ${
                        isIncome ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {formatCents(tx.amountCents)}
                    </span>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="p-1.5 text-slate-600 hover:text-rose-700"
                      title="Delete transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-600 text-center py-4">No recent transactions logged.</p>
        )}
      </section>

      {/* RECORD WAGE ADVANCE MODAL */}
      {showAdvanceModal && (
        <div data-daybridge-draft="true" role="dialog" aria-modal="true" aria-label="Edit money record" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-5 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-slate-900 mb-2">Record Wage Advance</h3>
            <p className="text-xs text-slate-600 mb-4">
              Enter money received early from apps like EarnIn/Dave/Brigit. It will be added to your
              cash balance now and deducted from your expected payday deposit.
            </p>

            <form onSubmit={handleRecordAdvance} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Advance Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={advanceAmountInput}
                  onChange={(e) => setAdvanceAmountInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Transfer / Instant Fee ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={advanceFeeInput}
                  onChange={(e) => setAdvanceFeeInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes</label>
                <input
                  type="text"
                  value={advanceNotesInput}
                  onChange={(e) => setAdvanceNotesInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold min-h-[44px]"
                >
                  Save Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECONCILE PAYCHECK MODAL */}
      {showReconcileModal && (
        <div data-daybridge-draft="true" role="dialog" aria-modal="true" aria-label="Edit money record" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-5 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-slate-900 mb-2">Reconcile Payday Deposit</h3>
            <p className="text-xs text-slate-600 mb-4">
              When your actual paycheck deposits, enter the final net amount received to update your
              balances and clear this cycle&apos;s advances.
            </p>

            <form onSubmit={handleReconcilePaycheck} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Actual Net Deposited ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={actualNetInput}
                  onChange={(e) => setActualNetInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold min-h-[44px]"
                >
                  Confirm Reconciliation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
