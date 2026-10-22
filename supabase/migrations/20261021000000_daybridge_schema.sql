-- DayBridge Supabase PostgreSQL Schema & Migrations
-- Phase 0: Security & Single Authorized Owner Database Baseline
-- Compatible with PostgreSQL 15+ and Supabase SSR

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. PROFILES & USER SETTINGS
-- ==========================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  timezone text not null default 'America/New_York',
  quiet_hours_start time default '22:00:00',
  quiet_hours_end time default '07:00:00',
  privacy_mode boolean default false,
  emergency_buffer_cents integer default 1000, -- $10.00 default buffer
  gas_target_cents integer default 3500,
  food_target_cents integer default 3000,
  reminder_lead_minutes integer default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- 2. CALENDAR EVENTS & RECURRENCE
-- Categories: 'court', 'therapy', 'case_management', 'work', 'personal', 'other'
-- ==========================================
create table if not exists public.calendar_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null check (category in ('court', 'therapy', 'case_management', 'work', 'personal', 'other')),
  description text default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  timezone text not null default 'America/New_York',
  venue_type text not null default 'in_person' check (venue_type in ('in_person', 'virtual', 'phone')),
  location text default '',
  meeting_url text default '',
  contact_info text default '',
  rrule text default null, -- RFC 5545 recurrence rule (e.g. FREQ=WEEKLY;BYDAY=WE)
  travel_buffer_minutes integer default 15,
  prep_checklist jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Materialized or specific occurrences with self-reported attendance
create table if not exists public.event_occurrences (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_time_utc timestamptz not null,
  end_time_utc timestamptz not null,
  attendance_status text not null default 'unconfirmed' check (attendance_status in ('unconfirmed', 'attended_self_reported', 'not_attended_self_reported', 'cancelled')),
  attendance_recorded_at timestamptz default null,
  attendance_note text default '',
  is_exception boolean not null default false,
  override_title text default null,
  override_start_time timestamptz default null,
  override_end_time timestamptz default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- 3. TASKS & PREPARATION CHECKLISTS
-- ==========================================
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text default '',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date timestamptz default null,
  completed boolean not null default false,
  completed_at timestamptz default null,
  linked_event_id uuid references public.calendar_events(id) on delete set null,
  is_recurring boolean not null default false,
  rrule text default null,
  subtasks jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- 4. MEDICATIONS & DOSE LOGS
-- Distinct scheduled vs PRN, slot uniqueness prevents double dose logging
-- ==========================================
create table if not exists public.medications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  strength_text text default '',
  instructions text default '',
  prescribing_clinician text default '',
  pharmacy_info text default '',
  is_prn boolean not null default false,
  inventory_count integer default null,
  refill_threshold integer default 7,
  refill_due_date date default null,
  notes text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medication_schedules (
  id uuid primary key default uuid_generate_v4(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  time_of_day time not null, -- e.g. 08:00:00
  days_of_week integer[] default '{0,1,2,3,4,5,6}', -- 0 = Sunday, 6 = Saturday
  dosage_label text default '1 dose',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medication_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  schedule_id uuid references public.medication_schedules(id) on delete set null,
  scheduled_slot_utc timestamptz not null, -- Intended slot time
  action text not null check (action in ('taken', 'skipped', 'snoozed')),
  recorded_at_utc timestamptz not null default now(),
  skip_reason text default '',
  request_id text default null,
  created_at timestamptz not null default now(),
  -- Prevent double logging the same scheduled slot for the same medication
  constraint uq_medication_user_slot unique (user_id, medication_id, scheduled_slot_utc, action)
);

-- ==========================================
-- 5. BUDGET, PAYCHECKS, ADVANCES & BILLS (INTEGER CENTS)
-- ==========================================
create table if not exists public.budget_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('checking', 'cash', 'savings', 'prepaid')),
  balance_cents integer not null default 0,
  last_confirmed_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.budget_accounts(id) on delete cascade,
  amount_cents integer not null, -- Positive for income/credit, negative for expense/debit
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer')),
  category text not null default 'general',
  transaction_date date not null default current_date,
  notes text default '',
  is_pending boolean not null default false,
  linked_transfer_id uuid references public.money_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paycheck_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expected_net_cents integer not null,
  next_payday date not null,
  recurring_frequency text not null default 'biweekly' check (recurring_frequency in ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  confidence text not null default 'high' check (confidence in ('high', 'medium', 'low')),
  actual_net_cents integer default null,
  reconciled_at timestamptz default null,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wage_advances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paycheck_plan_id uuid references public.paycheck_plans(id) on delete cascade,
  advance_amount_cents integer not null,
  fee_cents integer not null default 0,
  received_date date not null default current_date,
  is_reconciled boolean not null default false,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'housing',
  amount_cents integer not null,
  due_day_of_month integer check (due_day_of_month between 1 and 31),
  next_due_date date not null,
  is_autopay boolean not null default false,
  is_paid boolean not null default false,
  last_paid_at timestamptz default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_reserves (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('fuel', 'food', 'court', 'prescriptions', 'emergency', 'other')),
  target_cents integer not null default 0,
  allocated_cents integer not null default 0,
  is_essential boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- 6. REMINDERS & NOTIFICATION PIPELINE
-- ==========================================
create table if not exists public.reminder_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('event', 'medication', 'bill', 'task', 'refill')),
  source_id uuid not null,
  lead_minutes integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_occurrences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  due_at_utc timestamptz not null,
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed', 'snoozed', 'cancelled')),
  delivery_attempted_at timestamptz default null,
  generic_title text not null default 'DayBridge reminder',
  generic_body text not null default 'Open DayBridge to view scheduled item',
  created_at timestamptz not null default now(),
  constraint uq_reminder_dedupe unique (user_id, dedupe_key)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  user_agent text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_push_user_endpoint unique (user_id, endpoint)
);

-- ==========================================
-- 7. RESOURCE CONTACTS (PRIVATE LIST)
-- ==========================================
create table if not exists public.resource_contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('court', 'therapist', 'doctor', 'pharmacy', 'case_manager', 'transport', 'emergency', 'other')),
  phone text default '',
  email text default '',
  address text default '',
  notes text default '',
  is_emergency boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- Strict owner predicate: user_id = auth.uid()
-- ==========================================
alter table public.profiles enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_occurrences enable row level security;
alter table public.tasks enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_logs enable row level security;
alter table public.budget_accounts enable row level security;
alter table public.money_transactions enable row level security;
alter table public.paycheck_plans enable row level security;
alter table public.wage_advances enable row level security;
alter table public.bills enable row level security;
alter table public.budget_reserves enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.reminder_occurrences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.resource_contacts enable row level security;

-- PROFILES RLS
create policy "Owner read profiles" on public.profiles for select using (auth.uid() = id);
create policy "Owner insert profiles" on public.profiles for insert with check (auth.uid() = id);
create policy "Owner update profiles" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- CALENDAR EVENTS RLS
create policy "Owner read calendar_events" on public.calendar_events for select using (auth.uid() = user_id);
create policy "Owner insert calendar_events" on public.calendar_events for insert with check (auth.uid() = user_id);
create policy "Owner update calendar_events" on public.calendar_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete calendar_events" on public.calendar_events for delete using (auth.uid() = user_id);

-- EVENT OCCURRENCES RLS
create policy "Owner read event_occurrences" on public.event_occurrences for select using (auth.uid() = user_id);
create policy "Owner insert event_occurrences" on public.event_occurrences for insert with check (auth.uid() = user_id);
create policy "Owner update event_occurrences" on public.event_occurrences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete event_occurrences" on public.event_occurrences for delete using (auth.uid() = user_id);

-- TASKS RLS
create policy "Owner read tasks" on public.tasks for select using (auth.uid() = user_id);
create policy "Owner insert tasks" on public.tasks for insert with check (auth.uid() = user_id);
create policy "Owner update tasks" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete tasks" on public.tasks for delete using (auth.uid() = user_id);

-- MEDICATIONS RLS
create policy "Owner read medications" on public.medications for select using (auth.uid() = user_id);
create policy "Owner insert medications" on public.medications for insert with check (auth.uid() = user_id);
create policy "Owner update medications" on public.medications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete medications" on public.medications for delete using (auth.uid() = user_id);

-- MEDICATION SCHEDULES RLS
create policy "Owner read medication_schedules" on public.medication_schedules for select using (auth.uid() = user_id);
create policy "Owner insert medication_schedules" on public.medication_schedules for insert with check (auth.uid() = user_id);
create policy "Owner update medication_schedules" on public.medication_schedules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete medication_schedules" on public.medication_schedules for delete using (auth.uid() = user_id);

-- MEDICATION LOGS RLS
create policy "Owner read medication_logs" on public.medication_logs for select using (auth.uid() = user_id);
create policy "Owner insert medication_logs" on public.medication_logs for insert with check (auth.uid() = user_id);
create policy "Owner update medication_logs" on public.medication_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete medication_logs" on public.medication_logs for delete using (auth.uid() = user_id);

-- BUDGET ACCOUNTS RLS
create policy "Owner read budget_accounts" on public.budget_accounts for select using (auth.uid() = user_id);
create policy "Owner insert budget_accounts" on public.budget_accounts for insert with check (auth.uid() = user_id);
create policy "Owner update budget_accounts" on public.budget_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete budget_accounts" on public.budget_accounts for delete using (auth.uid() = user_id);

-- MONEY TRANSACTIONS RLS
create policy "Owner read money_transactions" on public.money_transactions for select using (auth.uid() = user_id);
create policy "Owner insert money_transactions" on public.money_transactions for insert with check (auth.uid() = user_id);
create policy "Owner update money_transactions" on public.money_transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete money_transactions" on public.money_transactions for delete using (auth.uid() = user_id);

-- PAYCHECK PLANS RLS
create policy "Owner read paycheck_plans" on public.paycheck_plans for select using (auth.uid() = user_id);
create policy "Owner insert paycheck_plans" on public.paycheck_plans for insert with check (auth.uid() = user_id);
create policy "Owner update paycheck_plans" on public.paycheck_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete paycheck_plans" on public.paycheck_plans for delete using (auth.uid() = user_id);

-- WAGE ADVANCES RLS
create policy "Owner read wage_advances" on public.wage_advances for select using (auth.uid() = user_id);
create policy "Owner insert wage_advances" on public.wage_advances for insert with check (auth.uid() = user_id);
create policy "Owner update wage_advances" on public.wage_advances for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete wage_advances" on public.wage_advances for delete using (auth.uid() = user_id);

-- BILLS RLS
create policy "Owner read bills" on public.bills for select using (auth.uid() = user_id);
create policy "Owner insert bills" on public.bills for insert with check (auth.uid() = user_id);
create policy "Owner update bills" on public.bills for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete bills" on public.bills for delete using (auth.uid() = user_id);

-- BUDGET RESERVES RLS
create policy "Owner read budget_reserves" on public.budget_reserves for select using (auth.uid() = user_id);
create policy "Owner insert budget_reserves" on public.budget_reserves for insert with check (auth.uid() = user_id);
create policy "Owner update budget_reserves" on public.budget_reserves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete budget_reserves" on public.budget_reserves for delete using (auth.uid() = user_id);

-- REMINDERS RLS
create policy "Owner read reminder_rules" on public.reminder_rules for select using (auth.uid() = user_id);
create policy "Owner insert reminder_rules" on public.reminder_rules for insert with check (auth.uid() = user_id);
create policy "Owner update reminder_rules" on public.reminder_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete reminder_rules" on public.reminder_rules for delete using (auth.uid() = user_id);

create policy "Owner read reminder_occurrences" on public.reminder_occurrences for select using (auth.uid() = user_id);
create policy "Owner insert reminder_occurrences" on public.reminder_occurrences for insert with check (auth.uid() = user_id);
create policy "Owner update reminder_occurrences" on public.reminder_occurrences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete reminder_occurrences" on public.reminder_occurrences for delete using (auth.uid() = user_id);

-- PUSH SUBSCRIPTIONS RLS
create policy "Owner read push_subscriptions" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "Owner insert push_subscriptions" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "Owner update push_subscriptions" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete push_subscriptions" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- RESOURCE CONTACTS RLS
create policy "Owner read resource_contacts" on public.resource_contacts for select using (auth.uid() = user_id);
create policy "Owner insert resource_contacts" on public.resource_contacts for insert with check (auth.uid() = user_id);
create policy "Owner update resource_contacts" on public.resource_contacts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete resource_contacts" on public.resource_contacts for delete using (auth.uid() = user_id);

-- INDEXES FOR PERFORMANCE & FAST LOOKUPS
create index if not exists idx_calendar_events_user_time on public.calendar_events (user_id, start_time);
create index if not exists idx_event_occurrences_user_time on public.event_occurrences (user_id, start_time_utc);
create index if not exists idx_tasks_user_due on public.tasks (user_id, completed, due_date);
create index if not exists idx_medications_user on public.medications (user_id, is_active);
create index if not exists idx_med_logs_user_slot on public.medication_logs (user_id, medication_id, scheduled_slot_utc);
create index if not exists idx_money_tx_user_date on public.money_transactions (user_id, transaction_date);
create index if not exists idx_bills_user_due on public.bills (user_id, is_paid, next_due_date);
create index if not exists idx_reminders_user_due on public.reminder_occurrences (user_id, status, due_at_utc);
