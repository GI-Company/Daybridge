import {
  calculateSafeToSpend,
  calculateRemainingPaycheck,
  parseDollarsToCents,
  formatCents,
} from '../lib/budget';
import { expandEventOccurrences, detectEventConflicts } from '../lib/recurrence';
import { getMedicationSlotsForDay, calculateRefillForecast } from '../lib/medication';
import { BudgetAccount, Bill, BudgetReserve, PaycheckPlan, WageAdvance, CalendarEvent, Medication, MedicationSchedule } from '../lib/types';

export function runTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message || String(e) });
    }
  }

  // 1. Budget Tests
  test('parseDollarsToCents handles decimals and integers accurately', () => {
    if (parseDollarsToCents('12.50') !== 1250) throw new Error('12.50 failed');
    if (parseDollarsToCents('12') !== 1200) throw new Error('12 failed');
    if (parseDollarsToCents('-5.25') !== -525) throw new Error('-5.25 failed');
    if (parseDollarsToCents('0.00') !== 0) throw new Error('0.00 failed');
  });

  test('calculateSafeToSpend clips at 0 and accurately computes shortfall', () => {
    const accounts: BudgetAccount[] = [
      { id: '1', userId: 'u1', name: 'Checking', accountType: 'checking', balanceCents: 15000, lastConfirmedAt: new Date().toISOString(), isActive: true }, // $150
    ];
    const bills: Bill[] = [
      { id: 'b1', userId: 'u1', title: 'Power', category: 'util', amountCents: 6000, nextDueDate: '2026-10-25', isAutopay: false, isPaid: false }, // $60
    ];
    const reserves: BudgetReserve[] = [
      { id: 'r1', userId: 'u1', name: 'Gas', category: 'fuel', targetCents: 3500, allocatedCents: 3500, isEssential: true }, // $35
      { id: 'r2', userId: 'u1', name: 'Food', category: 'food', targetCents: 3000, allocatedCents: 3000, isEssential: true }, // $30
    ];
    const emergencyBufferCents = 1000; // $10

    // 150 - 60 - 35 - 30 - 10 = 15 ($15.00)
    const result = calculateSafeToSpend({
      accounts,
      bills,
      reserves,
      nextPayday: '2026-10-30',
      emergencyBufferCents,
    });

    if (result.netSpendableCents !== 1500) {
      throw new Error(`Expected 1500 cents ($15.00), got ${result.netSpendableCents}`);
    }
    if (result.shortfallCents !== 0) {
      throw new Error(`Expected shortfall 0, got ${result.shortfallCents}`);
    }

    // Now test deficit
    const accountsDeficit: BudgetAccount[] = [
      { id: '1', userId: 'u1', name: 'Checking', accountType: 'checking', balanceCents: 5000, lastConfirmedAt: new Date().toISOString(), isActive: true }, // $50
    ];
    // 50 - 60 - 35 - 30 - 10 = -85
    const deficitResult = calculateSafeToSpend({
      accounts: accountsDeficit,
      bills,
      reserves,
      nextPayday: '2026-10-30',
      emergencyBufferCents,
    });

    if (deficitResult.netSpendableCents !== 0) {
      throw new Error(`Expected netSpendable to be clipped at 0, got ${deficitResult.netSpendableCents}`);
    }
    if (deficitResult.shortfallCents !== 8500) {
      throw new Error(`Expected shortfall 8500 cents ($85.00), got ${deficitResult.shortfallCents}`);
    }
  });

  test('calculateRemainingPaycheck deducts advances without double counting', () => {
    const plan: PaycheckPlan = {
      id: 'p1',
      userId: 'u1',
      expectedNetCents: 75000, // $750.00
      nextPayday: '2026-10-25',
      recurringFrequency: 'biweekly',
      confidence: 'high',
    };
    const advances: WageAdvance[] = [
      { id: 'a1', userId: 'u1', paycheckPlanId: 'p1', advanceAmountCents: 10000, feeCents: 399, receivedDate: '2026-10-21', isReconciled: false },
    ];

    const result = calculateRemainingPaycheck({ paycheckPlan: plan, advances });
    // 75000 - (10000 + 399) = 64601 ($646.01)
    if (result.netRemainingCents !== 64601) {
      throw new Error(`Expected 64601 cents, got ${result.netRemainingCents}`);
    }
    if (result.overadvancedCents !== 0) {
      throw new Error('Expected 0 overadvanced');
    }
  });

  // 2. Recurrence & Conflict Tests
  test('detectEventConflicts catches overlapping events and travel buffer shortages', () => {
    const occs = [
      {
        id: '1',
        eventId: 'e1',
        title: 'Court Class',
        startTime: new Date('2026-10-21T10:00:00Z'),
        endTime: new Date('2026-10-21T11:30:00Z'),
        travelBufferMinutes: 30,
      },
      {
        id: '2',
        eventId: 'e2',
        title: 'Work Shift',
        startTime: new Date('2026-10-21T11:45:00Z'), // Only 15m gap, but travel buffer is 30m!
        endTime: new Date('2026-10-21T17:00:00Z'),
        travelBufferMinutes: 15,
      },
    ];

    const conflicts = detectEventConflicts(occs);
    if (conflicts.length === 0) {
      throw new Error('Expected travel buffer conflict, none found');
    }
    if (conflicts[0].conflictType !== 'travel_buffer') {
      throw new Error(`Expected travel_buffer conflict, got ${conflicts[0].conflictType}`);
    }
  });

  // 3. Medication & Refill Forecast Tests
  test('calculateRefillForecast computes runout and flags low threshold', () => {
    const med: Medication = {
      id: 'm1',
      userId: 'u1',
      name: 'Sertraline',
      strengthText: '50mg',
      instructions: 'Daily',
      isPrn: false,
      inventoryCount: 5, // 5 pills left
      refillThreshold: 7, // threshold is 7
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };
    const schedules: MedicationSchedule[] = [
      { id: 's1', medicationId: 'm1', userId: 'u1', timeOfDay: '08:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dosageLabel: '1 tablet' },
    ];

    const forecast = calculateRefillForecast(med, schedules);
    if (forecast.daysRemaining !== 5) {
      throw new Error(`Expected 5 days remaining, got ${forecast.daysRemaining}`);
    }
    if (!forecast.needsRefillSoon) {
      throw new Error('Expected needsRefillSoon to be true');
    }
  });

  return results;
}
