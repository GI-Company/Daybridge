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
import {AddBudgetAccount} from './AddBudgetAccount';
import {PaycheckSetup} from './PaycheckSetup';

interface MoneyViewProps {
  onOpenQuickAdd: (type?: 'transaction'|'bill') => void;
}

export const MoneyView: React.FC<MoneyViewProps> = ({ onOpenQuickAdd }) => {
  const {
    accounts,
    updateAccountBalance,
    transactions,
    deleteTransaction,
    paycheckPlan,
    updatePaycheckPlan,
    recordPaycheckDeposit,
    advances,
    addAdvance,
    bills,
    markBillPaid,
    reserves,
    updateReserve,
    profile,
  } = useDayBridge();

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showAccountForm,setShowAccountForm]=useState(false);
  const [payingBillId,setPayingBillId]=useState<string|null>(null);
  const [billAccountId,setBillAccountId]=useState('');
  const activeAccounts=accounts.filter(a=>a.isActive);
  const [budgetMessage,setBudgetMessage]=useState('');
  const [newBalanceInput, setNewBalanceInput] = useState<string>('');

  const [showPaycheckSetup,setShowPaycheckSetup]=useState(false);
  const [advanceAccountId,setAdvanceAccountId]=useState('');
  const [depositAccountId,setDepositAccountId]=useState('');
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmountInput, setAdvanceAmountInput] = useState('');
  const [advanceFeeInput, setAdvanceFeeInput] = useState('0.00');
  const [advanceNotesInput, setAdvanceNotesInput] = useState('');

  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [actualNetInput, setActualNetInput] = useState('');

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
    if(!/^-?\d+(?:\.\d{1,2})?$/.test(newBalanceInput.trim())){
      setBudgetMessage('Enter a valid amount, such as 120.00.');return;
    }
    const cents = parseDollarsToCents(newBalanceInput);
    if(!Number.isSafeInteger(cents)){setBudgetMessage('That amount is too large.');return;}
    updateAccountBalance(accountId,cents);
    setBudgetMessage('Balance updated. Your manual transaction history is unchanged.');
    setEditingAccountId(null);
  };
  const confirmBillPayment=(billId:string)=>{
    const account=activeAccounts.find(a=>a.id===billAccountId);
    if(!account){setBudgetMessage('Choose the account that paid this bill.');return;}
    const name=bills.find(b=>b.id===billId)?.title||'Bill';
    markBillPaid(billId,true,account.id);
    setPayingBillId(null);setBillAccountId('');
    setBudgetMessage(name+' marked paid and deducted from '+account.name+'.');
  };

  const handleRecordAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseDollarsToCents(advanceAmountInput);
    const feeCents = parseDollarsToCents(advanceFeeInput);
    if(!paycheckPlan){setBudgetMessage('Set up your next paycheck before tracking advances.');return;}
    if(!Number.isSafeInteger(amountCents)||amountCents<=0||!activeAccounts.some(a=>a.id===advanceAccountId)){
      setBudgetMessage('Enter a valid advance amount and choose where it was deposited.');return;
    }
    if(feeCents<0||!Number.isSafeInteger(feeCents)){setBudgetMessage('Enter a valid nonnegative fee.');return;}
    addAdvance({
      paycheckPlanId: paycheckPlan?.id,
      advanceAmountCents: amountCents,
      feeCents,
      receivedDate: new Date().toISOString().split('T')[0],
      isReconciled: false,
      notes: advanceNotesInput.trim(),
    },advanceAccountId);
    setBudgetMessage('Advance recorded in the selected account and deducted from this paycheck forecast.');
    setShowAdvanceModal(false);
  };

  const handleReconcilePaycheck = (e: React.FormEvent) => {
    e.preventDefault();
    const actualCents = parseDollarsToCents(actualNetInput);
    if(!paycheckPlan||paycheckPlan.reconciledAt)return;
    if(!Number.isSafeInteger(actualCents)||actualCents<=0||!activeAccounts.some(a=>a.id===depositAccountId)){
      setBudgetMessage('Enter the actual deposit and select the account receiving it.');return;
    }
    if(!recordPaycheckDeposit(depositAccountId,actualCents)){
      setBudgetMessage('Unable to record deposit. Check the account and paycheck status.');return;
    }
    setBudgetMessage('Paycheck deposit added to your selected account and transaction history.');
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
          onClick={()=>onOpenQuickAdd('transaction')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-100/70"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Income / Expense</span>
        </button>
      </div>

      {budgetMessage&&<p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">{budgetMessage}</p>}
      {accounts.length===0&&<div className="space-y-3 rounded-2xl border border-teal-300 bg-white p-4">
        <h3 className="text-lg font-bold text-slate-950">Set up your budget</h3>
        <p className="text-sm text-slate-700">No money accounts yet. Add where you keep your money, even if you start with $0. Then income and expenses will update its balance automatically.</p>
        <AddBudgetAccount onCreated={()=>{setShowAccountForm(false);setBudgetMessage('Account created. You can now record income or spending.')}}/>
      </div>}
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
            {activeAccounts.length?formatCents(safeToSpend.netSpendableCents):'Not set'}
          </div>
          {!activeAccounts.length&&<p className="text-sm text-slate-700">Add a money account above to calculate your available balance.</p>}
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Your money accounts</h3>
            <p className="text-xs text-slate-600">
              Confirm balances regularly; never requires bank credentials
            </p>
          </div>
          {accounts.length>0&&<button type="button" onClick={()=>setShowAccountForm(v=>!v)}
            className="min-h-[44px] rounded-xl border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-900">
            {showAccountForm?'Cancel':'+ Add account'}
          </button>}
        </div>
        {showAccountForm&&accounts.length>0&&<div className="mb-4">
          <AddBudgetAccount onCreated={()=>{setShowAccountForm(false);setBudgetMessage('Account created.');}}
            onCancel={()=>setShowAccountForm(false)}/>
        </div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {accounts.filter(acc=>acc.isActive).map((acc) => (
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
                <div data-daybridge-draft="true" className="flex items-center gap-1.5">
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
      <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
        <summary className="cursor-pointer text-base font-bold text-slate-900">Paycheck planning (optional)</summary>
        <section className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Next paycheck and advances</h3>
            <p className="text-xs text-slate-600">
              Deducts advances from expected paycheck; avoids double-counting spendable cash
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>setShowPaycheckSetup(v=>!v)}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
              {showPaycheckSetup?'Cancel':paycheckPlan?'Edit next payday':'+ Plan paycheck'}
            </button>
            {paycheckPlan&&<button
              onClick={() => {setAdvanceAccountId(activeAccounts.length===1?activeAccounts[0].id:'');setShowAdvanceModal(true)}}
              data-daybridge-edit-button="true" className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 border border-slate-300 min-h-[44px]"
            >
              + Record Advance
            </button>}
            {paycheckPlan&&!paycheckPlan.reconciledAt&&<button
              onClick={() => {setDepositAccountId(activeAccounts.length===1?activeAccounts[0].id:'');setShowReconcileModal(true)}}
              className="px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-800 border border-teal-500/30 hover:bg-teal-500/30 text-xs font-bold min-h-[44px]"
            >
              Record deposit
            </button>}
          </div>
        </div>
        {showPaycheckSetup&&<div className="mb-4"><PaycheckSetup onSaved={()=>{setShowPaycheckSetup(false);setBudgetMessage('Paycheck forecast saved. It does not change your account balance.')}} onCancel={()=>setShowPaycheckSetup(false)}/></div>}
        {!paycheckPlan&&!showPaycheckSetup&&<p className="text-sm text-slate-700">Add an optional payday forecast to track upcoming paychecks and advances. Everyday income and expenses work without one.</p>}
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
      </details>

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
            onClick={()=>onOpenQuickAdd('bill')}
            className="min-h-[44px] text-xs text-teal-700 hover:text-teal-800 font-medium"
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
                    onClick={()=>{setPayingBillId(bill.id);setBillAccountId(activeAccounts.length===1?activeAccounts[0].id:'');setBudgetMessage('')}}
                    className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-950/40"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {payingBillId&&<div className="mt-3 space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <h4 className="font-semibold text-slate-950">Pay from which account?</h4>
          {activeAccounts.length===0?<p className="text-sm text-amber-900">Add a money account first. The bill has not been marked paid.</p>:
            <label className="block text-sm text-slate-800">Account
              <select value={billAccountId} onChange={e=>setBillAccountId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3">
                <option value="">Choose account</option>
                {activeAccounts.map(a=><option value={a.id} key={a.id}>{a.name} ({formatCents(a.balanceCents)})</option>)}
              </select>
            </label>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!billAccountId} onClick={()=>confirmBillPayment(payingBillId)}
              className="min-h-[44px] rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm payment</button>
            <button type="button" onClick={()=>{setPayingBillId(null);setBillAccountId('')}} className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>}
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
            onClick={()=>onOpenQuickAdd('transaction')}
            className="min-h-[44px] text-xs text-teal-700 hover:text-teal-800 font-medium"
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
              <label className="block text-sm font-semibold text-slate-800">Deposit into account
                <select required value={advanceAccountId} onChange={e=>setAdvanceAccountId(e.target.value)}
                 className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                 <option value="">Choose an account</option>
                 {activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
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
              Record the money actually deposited into the account you choose. Your transaction history and balance will update together.
            </p>

            <form onSubmit={handleReconcilePaycheck} className="space-y-3 text-xs">
              <p className="text-xs text-amber-900">Record only the amount actually deposited. If you already entered this income elsewhere, don't record it again.</p>
              <label className="block text-sm font-semibold text-slate-800">Received into account
                <select required value={depositAccountId} onChange={e=>setDepositAccountId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                  <option value="">Choose an account</option>
                  {activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
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
                  Save deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
