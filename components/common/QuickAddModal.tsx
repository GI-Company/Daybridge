'use client';

import React, { useState } from 'react';
import {
  X,
  Calendar,
  Pill,
  CheckSquare,
  DollarSign,
  Scale,
  Briefcase,
  HeartHandshake,
  Receipt,
  PhoneCall,
  Clock,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { parseDollarsToCents } from '../../lib/budget';
import { EventCategory, VenueType, PriorityLevel } from '../../lib/types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuickAddType = 'event' | 'medication' | 'task' | 'transaction' | 'bill' | 'contact';

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose }) => {
  const { addEvent, addMedication, addTask, addTransaction, addBill, addContact, accounts } = useDayBridge();

  const [activeType, setActiveType] = useState<QuickAddType>('event');

  // Event form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventCategory, setEventCategory] = useState<EventCategory>('court');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventStartTime, setEventStartTime] = useState('10:00');
  const [eventEndTime, setEventEndTime] = useState('11:00');
  const [eventVenue, setEventVenue] = useState<VenueType>('in_person');
  const [eventLocation, setEventLocation] = useState('');
  const [eventTravelBuffer, setEventTravelBuffer] = useState('15');
  const [eventRepeatWeekly, setEventRepeatWeekly] = useState(false);
  const [eventContact, setEventContact] = useState('');

  // Medication form state
  const [medName, setMedName] = useState('');
  const [medStrength, setMedStrength] = useState('');
  const [medInstructions, setMedInstructions] = useState('');
  const [medTimeOfDay, setMedTimeOfDay] = useState('08:00');
  const [medInventory, setMedInventory] = useState('30');
  const [medIsPrn, setMedIsPrn] = useState(false);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<PriorityLevel>('medium');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);

  // Money transaction form state
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('fuel');
  const [txNotes, setTxNotes] = useState('');

  // Bill form state
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDate, setBillDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [billAutopay, setBillAutopay] = useState(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactCategory, setContactCategory] = useState<
    'court' | 'therapist' | 'doctor' | 'pharmacy' | 'case_manager' | 'transport' | 'emergency' | 'other'
  >('court');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeType === 'event') {
      if (!eventTitle.trim()) return;
      const startIso = `${eventDate}T${eventStartTime}:00`;
      const endIso = `${eventDate}T${eventEndTime}:00`;
      const rrule = eventRepeatWeekly ? 'FREQ=WEEKLY' : undefined;

      addEvent({
        title: eventTitle.trim(),
        category: eventCategory,
        description: '',
        startTime: startIso,
        endTime: endIso,
        timezone: 'America/New_York',
        venueType: eventVenue,
        location: eventLocation.trim(),
        contactInfo: eventContact.trim(),
        rrule,
        travelBufferMinutes: parseInt(eventTravelBuffer, 10) || 0,
        prepChecklist: [],
      });
    } else if (activeType === 'medication') {
      if (!medName.trim()) return;
      addMedication(
        {
          name: medName.trim(),
          strengthText: medStrength.trim(),
          instructions: medInstructions.trim(),
          isPrn: medIsPrn,
          inventoryCount: medInventory ? parseInt(medInventory, 10) : undefined,
          refillThreshold: 7,
          notes: '',
        },
        medIsPrn
          ? []
          : [
              {
                timeOfDay: medTimeOfDay,
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                dosageLabel: medStrength.trim() || '1 dose',
              },
            ]
      );
    } else if (activeType === 'task') {
      if (!taskTitle.trim()) return;
      addTask({
        title: taskTitle.trim(),
        priority: taskPriority,
        dueDate: taskDueDate ? `${taskDueDate}T12:00:00` : undefined,
        isRecurring: false,
        subtasks: [],
      });
    } else if (activeType === 'transaction') {
      const cents = parseDollarsToCents(txAmount);
      if (!cents || accounts.length === 0) return;
      const signedCents = txType === 'expense' ? -Math.abs(cents) : Math.abs(cents);
      addTransaction({
        accountId: accounts[0].id,
        amountCents: signedCents,
        transactionType: txType,
        category: txCategory,
        transactionDate: new Date().toISOString().split('T')[0],
        notes: txNotes.trim(),
        isPending: false,
      });
    } else if (activeType === 'bill') {
      const cents = parseDollarsToCents(billAmount);
      if (!billTitle.trim() || !cents) return;
      addBill({
        title: billTitle.trim(),
        category: 'utilities',
        amountCents: Math.abs(cents),
        nextDueDate: billDueDate,
        isAutopay: billAutopay,
      });
    } else if (activeType === 'contact') {
      if (!contactName.trim()) return;
      addContact({
        name: contactName.trim(),
        category: contactCategory,
        phone: contactPhone.trim(),
        notes: contactNotes.trim(),
        isEmergency: contactCategory === 'emergency',
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-950/40">
          <h2 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            <span>Quick Add</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Selector Pills (44px min tap targets) */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-200 overflow-x-auto flex gap-1.5 scrollbar-none">
          {[
            { id: 'event', label: 'Appointment / Class', icon: Calendar },
            { id: 'medication', label: 'Medication', icon: Pill },
            { id: 'task', label: 'Task', icon: CheckSquare },
            { id: 'transaction', label: 'Expense / Income', icon: DollarSign },
            { id: 'bill', label: 'Bill', icon: Receipt },
            { id: 'contact', label: 'Contact', icon: PhoneCall },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = activeType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveType(item.id as QuickAddType)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap min-h-[44px] transition ${
                  isSelected
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-100/70'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-100 hover:text-slate-950 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* EVENT / APPOINTMENT FORM */}
          {activeType === 'event' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'court', label: 'Court / Class', icon: Scale },
                    { id: 'therapy', label: 'Therapy', icon: HeartHandshake },
                    { id: 'work', label: 'Work Shift', icon: Briefcase },
                    { id: 'case_management', label: 'Case Mgmt', icon: CheckSquare },
                    { id: 'personal', label: 'Personal', icon: Calendar },
                    { id: 'other', label: 'Other', icon: Clock },
                  ].map((cat) => {
                    const isCatSelected = eventCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setEventCategory(cat.id as EventCategory)}
                        className={`flex items-center gap-1.5 p-2 rounded-lg text-xs font-medium min-h-[44px] justify-center transition border ${
                          isCatSelected
                            ? 'bg-teal-500/20 text-teal-800 border-teal-500/50 font-semibold'
                            : 'bg-slate-100/90 text-slate-600 border-slate-700/40 hover:bg-slate-100'
                        }`}
                      >
                        <cat.icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Title / Obligation
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Accountability Class or CBT Session"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Location or Meeting Link</label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204 or Telehealth URL"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Travel Buffer (min)</label>
                  <select
                    value={eventTravelBuffer}
                    onChange={(e) => setEventTravelBuffer(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500 min-h-[42px]"
                  >
                    <option value="0">0 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="repeatWeekly"
                  checked={eventRepeatWeekly}
                  onChange={(e) => setEventRepeatWeekly(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400 bg-slate-50"
                />
                <label htmlFor="repeatWeekly" className="text-xs text-slate-700">
                  Repeat weekly on this day (e.g. every Wednesday class)
                </label>
              </div>
            </>
          )}

          {/* MEDICATION FORM */}
          {activeType === 'medication' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Medication Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sertraline, Lisinopril, Blood Pressure Rx"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Strength / Dose</label>
                  <input
                    type="text"
                    placeholder="e.g. 50 mg, 1 tablet"
                    value={medStrength}
                    onChange={(e) => setMedStrength(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Initial Pill Count (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    value={medInventory}
                    onChange={(e) => setMedInventory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Label Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Take daily in the morning with water."
                  value={medInstructions}
                  onChange={(e) => setMedInstructions(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPrn"
                  checked={medIsPrn}
                  onChange={(e) => setMedIsPrn(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 bg-slate-50"
                />
                <label htmlFor="isPrn" className="text-xs text-slate-700">
                  As needed (PRN) — no fixed daily reminder time
                </label>
              </div>

              {!medIsPrn && (
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Daily Schedule Time</label>
                  <input
                    type="time"
                    value={medTimeOfDay}
                    onChange={(e) => setMedTimeOfDay(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              )}

              <p className="text-[11px] text-slate-600 italic">
                * Personal logging only. Always follow prescription label and clinician instructions.
              </p>
            </>
          )}

          {/* TASK FORM */}
          {activeType === 'task' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Print weekly review log, confirm ride to court"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as PriorityLevel)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500 min-h-[42px]"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* TRANSACTION FORM */}
          {activeType === 'transaction' && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold min-h-[44px] transition ${
                    txType === 'expense'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold min-h-[44px] transition ${
                    txType === 'income'
                      ? 'bg-teal-500/20 text-teal-800 border border-teal-500/40'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-base font-semibold text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Category</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500 min-h-[42px]"
                  >
                    <option value="fuel">Fuel / Bus</option>
                    <option value="food">Groceries / Food</option>
                    <option value="prescriptions">Prescriptions</option>
                    <option value="court">Court / Fees</option>
                    <option value="housing">Housing / Rent</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Note / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Gas pump #4"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* BILL FORM */}
          {activeType === 'bill' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Bill Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electric bill, Phone service"
                  value={billTitle}
                  onChange={(e) => setBillTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="65.00"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="billAutopay"
                  checked={billAutopay}
                  onChange={(e) => setBillAutopay(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 bg-slate-50"
                />
                <label htmlFor="billAutopay" className="text-xs text-slate-700">
                  Set on Autopay (Informational reminder)
                </label>
              </div>
            </>
          )}

          {/* CONTACT FORM */}
          {activeType === 'contact' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Officer Miller, Dr. Chen, Pharmacy Desk"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Category</label>
                  <select
                    value={contactCategory}
                    onChange={(e) => setContactCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500 min-h-[42px]"
                  >
                    <option value="court">Court Officer / Case Worker</option>
                    <option value="therapist">Therapist / Counselor</option>
                    <option value="doctor">Doctor / Clinic</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="transport">Transit / Driver</option>
                    <option value="emergency">Emergency / Crisis</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Notes / Hours</label>
                <input
                  type="text"
                  placeholder="e.g. Office hours 9am-4pm"
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-teal-500"
                />
              </div>
            </>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 min-h-[44px] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 min-h-[44px] shadow-lg shadow-teal-100/70 transition"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
