-- Additive, default-off reporting. Apply only to a local/test database until approved.
-- No private organizer grants, account changes, seeds, or historical backfill.
create table public.daybridge_reporting_courts (
 court_id uuid primary key references public.daybridge_courts(id) on delete restrict,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.daybridge_reporting_consent (
 user_id uuid not null references auth.users(id) on delete cascade,
 court_id uuid not null references public.daybridge_courts(id) on delete restrict,
 category text not null check(category in ('meeting','class','check_in','obligation')),
 enabled boolean not null default false,
 revision integer not null default 1,
 enabled_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,court_id,category)
);
create table public.daybridge_reporting_consent_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 court_id uuid not null references public.daybridge_courts(id) on delete restrict,
 category text not null check(category in ('meeting','class','check_in','obligation')),
 enabled boolean not null,
 revision integer not null,
 reason text not null check(reason in ('participant_choice','access_ended')),
 created_at timestamptz not null default now()
);
-- These private source references are never returned to staff.
create table public.daybridge_reporting_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 court_id uuid not null references public.daybridge_courts(id) on delete restrict,
 source_id text not null check(length(source_id) between 1 and 120),
 source_kind text not null check(source_kind in ('event','task')),
 source_version text not null check(length(source_version)=32),
 category text not null check(category in ('meeting','class','check_in','obligation')),
 consent_revision integer not null,
 share_from timestamptz not null,
 include_history boolean not null default false,
 selected_at timestamptz not null default now(),
 primary key(user_id,court_id,source_kind,source_id)
);
create table public.daybridge_progress_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 court_id uuid not null references public.daybridge_courts(id) on delete restrict,
 source_key text not null check(length(source_key)=32),
 category text not null check(category in ('meeting','class','check_in','obligation')),
 status text not null check(status in ('complete','not_reported','incomplete','cancelled','withdrawn','unknown')),
 scheduled_at timestamptz,
 ends_at timestamptz,
 reported_at timestamptz,
 provenance text not null check(provenance in ('participant_self_report','explicit_history')),
 consent_revision integer not null,
 first_shared_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,court_id,source_key)
);
create index daybridge_progress_period_idx on public.daybridge_progress_events(court_id,scheduled_at,user_id) where status<>'withdrawn';
create index daybridge_progress_user_idx on public.daybridge_progress_events(user_id,court_id);
create index daybridge_consent_history_user_idx on public.daybridge_reporting_consent_history(user_id,created_at desc);
create table public.daybridge_report_access_audit (
 id uuid primary key default gen_random_uuid(),
 court_id uuid not null references public.daybridge_courts(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 subject_user_id uuid references auth.users(id) on delete restrict,
 period_start timestamptz not null,
 period_end timestamptz not null,
 category text check(category in ('meeting','class','check_in','obligation')),
 accessed_at timestamptz not null default now()
);
create index daybridge_report_audit_court_idx on public.daybridge_report_access_audit(court_id,accessed_at desc);
create index daybridge_report_audit_actor_idx on public.daybridge_report_access_audit(actor_id);
create index daybridge_report_audit_subject_idx on public.daybridge_report_access_audit(subject_user_id);

-- Closed registries: every browser role (including staff/owner) is denied directly.
-- Authenticated API handlers use service-only RPCs with independent DB authorization.
alter table public.daybridge_reporting_courts enable row level security;
alter table public.daybridge_reporting_consent enable row level security;
alter table public.daybridge_reporting_consent_history enable row level security;
alter table public.daybridge_reporting_items enable row level security;
alter table public.daybridge_progress_events enable row level security;
alter table public.daybridge_report_access_audit enable row level security;
revoke all on public.daybridge_reporting_courts,public.daybridge_reporting_consent,
 public.daybridge_reporting_consent_history,public.daybridge_reporting_items,
 public.daybridge_progress_events,public.daybridge_report_access_audit from public,anon,authenticated;
grant select,insert,update,delete on public.daybridge_reporting_courts,public.daybridge_reporting_consent,
 public.daybridge_reporting_consent_history,public.daybridge_reporting_items,
 public.daybridge_progress_events,public.daybridge_report_access_audit to service_role;

-- Unexposed helpers. Untrusted/malformed private dates must not break private saves.
create function daybridge_private.reporting_time(p_value text,p_zone text default 'UTC') returns timestamptz
language plpgsql stable set search_path='' set timezone='UTC' as $$
begin
 if p_value ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then return p_value::timestamptz; end if;
 return p_value::timestamp at time zone coalesce(p_zone,'UTC');
 exception when others then return null; end;
$$;
create function daybridge_private.reporting_array(p_value jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p_value)='array' then p_value else '[]'::jsonb end;
$$;

-- Bind an explicit item choice to its schedule/link, never its private text.
-- A schedule edit withdraws the report until the participant reviews it again.
create function daybridge_private.reporting_source_version(p_user uuid,p_kind text,p_source text) returns text
language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(e->>'startTime',e->>'endTime',e->>'timezone',e->>'rrule',e->>'category')::text)
  from public.private_snapshots s cross join lateral jsonb_array_elements(daybridge_private.reporting_array(s.payload->'events')) e
  where s.user_id=p_user and p_kind='event' and e->>'id'=p_source
 union all
 select md5(jsonb_build_array(t->>'dueDate',t->>'linkedEventId',s.payload->'profile'->>'timezone')::text)
  from public.private_snapshots s cross join lateral jsonb_array_elements(daybridge_private.reporting_array(s.payload->'tasks')) t
  where s.user_id=p_user and p_kind='task' and t->>'id'=p_source limit 1;
$$;

-- Only this unexposed projection reads the participant's snapshot, using a strict
-- allowlist. A staff-facing query never reads the snapshot or any organizer table.
create function daybridge_private.reporting_candidates(p_user uuid,p_court uuid)
returns table(source_key text,category text,status text,scheduled_at timestamptz,ends_at timestamptz,
 reported_at timestamptz,provenance text,consent_revision integer)
language sql stable security definer set search_path='' as $$
 with snapshot as (
  select payload from public.private_snapshots where user_id=p_user
 ), choices as (
  select i.* from public.daybridge_reporting_items i
  join public.daybridge_reporting_consent c using(user_id,court_id,category)
  where i.user_id=p_user and i.court_id=p_court and c.enabled and c.revision=i.consent_revision
   and i.source_version=daybridge_private.reporting_source_version(p_user,i.source_kind,i.source_id)
 ), approved_events as (
  select e from snapshot s cross join lateral jsonb_array_elements(daybridge_private.reporting_array(s.payload->'events')) e
  where e->>'category' in ('court','case_management','class')
 ), event_rows as (
  select i.*,e,coalesce(o->>'overrideStartTime',o->>'startTimeUtc',e->>'startTime') as starts,
   coalesce(o->>'overrideEndTime',o->>'endTimeUtc',e->>'endTime') as ends,
   o->>'attendanceStatus' as attendance,o->>'attendanceRecordedAt' as recorded
  from choices i join approved_events a on a.e->>'id'=i.source_id
  cross join snapshot s
  left join lateral (
   select o from jsonb_array_elements(daybridge_private.reporting_array(s.payload->'eventOccurrences')) o
    where o->>'eventId'=i.source_id and (coalesce(a.e->>'rrule','')<>'' or daybridge_private.reporting_time(o->>'startTimeUtc')=daybridge_private.reporting_time(a.e->>'startTime',a.e->>'timezone'))
   union all select null::jsonb where coalesce(a.e->>'rrule','')='' and not exists(
    select 1 from jsonb_array_elements(daybridge_private.reporting_array(s.payload->'eventOccurrences')) o where o->>'eventId'=i.source_id and (coalesce(a.e->>'rrule','')<>'' or daybridge_private.reporting_time(o->>'startTimeUtc')=daybridge_private.reporting_time(a.e->>'startTime',a.e->>'timezone')))
  ) occurrences on true
  where i.source_kind='event' and ((e->>'category'='class' and i.category='class')
   or (e->>'category' in ('court','case_management') and i.category in ('meeting','check_in','obligation')))
   -- Unrecorded recurring occurrences are unknown, not fabricated as missed.
   and (coalesce(e->>'rrule','')='' or daybridge_private.reporting_time(o->>'attendanceRecordedAt')>=i.share_from)
 ), task_rows as (
  select i.*,t,coalesce(s.payload->'profile'->>'timezone','UTC') as zone from choices i cross join snapshot s
  cross join lateral jsonb_array_elements(daybridge_private.reporting_array(s.payload->'tasks')) t
  where i.source_kind='task' and i.category='obligation' and t->>'id'=i.source_id
   and exists(select 1 from approved_events a where a.e->>'id'=t->>'linkedEventId' and a.e->>'category' in ('court','case_management'))
 )
 select md5('event:'||source_id||':'||starts),category,
  case when attendance='cancelled' then 'cancelled'
   when attendance='attended_self_reported' and daybridge_private.reporting_time(recorded)>=share_from then 'complete'
   when attendance='not_attended_self_reported' and daybridge_private.reporting_time(recorded)>=share_from then 'incomplete'
   else 'not_reported' end,
  daybridge_private.reporting_time(starts,e->>'timezone'),daybridge_private.reporting_time(ends,e->>'timezone'),
  case when daybridge_private.reporting_time(recorded)>=share_from then daybridge_private.reporting_time(recorded) end,
  case when include_history then 'explicit_history' else 'participant_self_report' end,consent_revision
 from event_rows where daybridge_private.reporting_time(starts,e->>'timezone')>=share_from
 union all
 select md5('task:'||source_id),category,
  case when t->>'completed'='true' and daybridge_private.reporting_time(t->>'completedAt')>=share_from then 'complete'
   when daybridge_private.reporting_time(t->>'dueDate',zone) is null then 'unknown' else 'not_reported' end,
  daybridge_private.reporting_time(t->>'dueDate',zone),daybridge_private.reporting_time(t->>'dueDate',zone),
  case when daybridge_private.reporting_time(t->>'completedAt')>=share_from then daybridge_private.reporting_time(t->>'completedAt') end,
  case when include_history then 'explicit_history' else 'participant_self_report' end,consent_revision
 from task_rows where daybridge_private.reporting_time(t->>'dueDate',zone)>=share_from
  or (daybridge_private.reporting_time(t->>'dueDate',zone) is null and selected_at>=share_from);
$$;

create function daybridge_private.reconcile_reporting(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_court uuid;
begin
 select p.court_id into v_court from public.daybridge_court_participants p
  join public.daybridge_courts c on c.id=p.court_id and c.enabled
  join public.daybridge_reporting_courts f on f.court_id=c.id and f.enabled
  where p.user_id=p_user and p.status='active';
 -- Mark stale, deleted, unshared or corrected entries withdrawn. No old completion
 -- can survive a private deletion or an item losing its eligibility.
 update public.daybridge_progress_events e set status='withdrawn',reported_at=null,updated_at=now()
  where e.user_id=p_user and e.status<>'withdrawn' and (v_court is null or e.court_id<>v_court
   or not exists(select 1 from daybridge_private.reporting_candidates(p_user,v_court) n where n.source_key=e.source_key));
 if v_court is null then return; end if;
 insert into public.daybridge_progress_events(user_id,court_id,source_key,category,status,scheduled_at,ends_at,reported_at,provenance,consent_revision)
 select p_user,v_court,n.* from daybridge_private.reporting_candidates(p_user,v_court) n
 on conflict(user_id,court_id,source_key) do update set category=excluded.category,status=excluded.status,
  scheduled_at=excluded.scheduled_at,ends_at=excluded.ends_at,reported_at=excluded.reported_at,
  provenance=excluded.provenance,consent_revision=excluded.consent_revision,updated_at=now()
 where (daybridge_progress_events.category,daybridge_progress_events.status,daybridge_progress_events.scheduled_at,
  daybridge_progress_events.ends_at,daybridge_progress_events.reported_at,daybridge_progress_events.provenance,daybridge_progress_events.consent_revision)
 is distinct from (excluded.category,excluded.status,excluded.scheduled_at,excluded.ends_at,excluded.reported_at,excluded.provenance,excluded.consent_revision);
end;
$$;
create function daybridge_private.reporting_snapshot_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform daybridge_private.reconcile_reporting(coalesce(new.user_id,old.user_id));
 return null;
end;
$$;
create trigger daybridge_reporting_snapshot after insert or update or delete on public.private_snapshots
 for each row execute function daybridge_private.reporting_snapshot_changed();

-- Suspension/removal, court disable and feature disable terminate consent. A later
-- restore never silently resumes sharing or imports the paused interval.
create function daybridge_private.end_reporting(p_user uuid,p_court uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 with ended as (
  update public.daybridge_reporting_consent set enabled=false,revision=revision+1,updated_at=now()
   where user_id=p_user and court_id=p_court and enabled returning *
 ) insert into public.daybridge_reporting_consent_history(user_id,court_id,category,enabled,revision,reason)
  select user_id,court_id,category,false,revision,'access_ended' from ended;
 delete from public.daybridge_reporting_items where user_id=p_user and court_id=p_court;
 update public.daybridge_progress_events set status='withdrawn',reported_at=null,updated_at=now()
  where user_id=p_user and court_id=p_court and status<>'withdrawn';
end;
$$;
create function daybridge_private.reporting_access_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if tg_table_name='daybridge_court_participants' then
  if new.status<>'active' or new.court_id<>old.court_id then perform daybridge_private.end_reporting(old.user_id,old.court_id); end if;
 elsif not new.enabled then
  for r in select user_id,court_id from public.daybridge_reporting_consent where court_id=new.court_id group by user_id,court_id loop
   perform daybridge_private.end_reporting(r.user_id,r.court_id);
  end loop;
 end if;
 return null;
end;
$$;
create trigger daybridge_reporting_participant_access after update of status,court_id on public.daybridge_court_participants
 for each row execute function daybridge_private.reporting_access_changed();
create trigger daybridge_reporting_feature_access after update of enabled on public.daybridge_reporting_courts
 for each row execute function daybridge_private.reporting_access_changed();
-- Courts use id rather than court_id, so keep the court-disable trigger separate.
create function daybridge_private.reporting_court_disabled() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if not new.enabled then
  for r in select user_id from public.daybridge_court_participants where court_id=new.id loop
   perform daybridge_private.end_reporting(r.user_id,new.id);
  end loop;
 end if;
 return null;
end;
$$;
create trigger daybridge_reporting_court_access after update of enabled on public.daybridge_courts
 for each row execute function daybridge_private.reporting_court_disabled();

-- RPCs take the server-authenticated actor, never an actor supplied in HTTP JSON.
create function public.daybridge_participant_reporting(p_actor uuid,p_input jsonb default '{"action":"read"}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_court uuid;v_flag boolean;v_action text:=p_input->>'action';v_category text:=p_input->>'category';
 v_consent public.daybridge_reporting_consent;v_from timestamptz;v_history boolean;v_source text:=p_input->>'source_id';
begin
 select p.court_id,coalesce(f.enabled,false) and c.enabled into v_court,v_flag
  from public.daybridge_court_participants p join public.daybridge_courts c on c.id=p.court_id
  left join public.daybridge_reporting_courts f on f.court_id=c.id where p.user_id=p_actor and p.status='active' for update of p;
 if v_court is null or not daybridge_private.workspace_access_for_user(p_actor) or daybridge_private.platform_owner(p_actor) or exists(select 1 from public.daybridge_court_staff where user_id=p_actor and active)
  then raise exception 'Participant access required' using errcode='42501'; end if;
 if v_action<>'read' and v_action<>'consent' and not v_flag then raise exception 'Reporting is disabled for this court' using errcode='42501'; end if;
 if v_action='consent' then
  if v_category is null or v_category not in ('meeting','class','check_in','obligation') or jsonb_typeof(p_input->'enabled')<>'boolean' then raise exception 'Invalid consent'; end if;
  if (p_input->>'enabled')::boolean and not v_flag then raise exception 'Reporting is disabled for this court' using errcode='42501'; end if;
  insert into public.daybridge_reporting_consent(user_id,court_id,category,enabled)
   values(p_actor,v_court,v_category,(p_input->>'enabled')::boolean)
   on conflict(user_id,court_id,category) do update set enabled=excluded.enabled,revision=daybridge_reporting_consent.revision+1,
    enabled_at=now(),updated_at=now();
  insert into public.daybridge_reporting_consent_history(user_id,court_id,category,enabled,revision,reason)
   select user_id,court_id,category,enabled,revision,'participant_choice' from public.daybridge_reporting_consent
    where user_id=p_actor and court_id=v_court and category=v_category;
  delete from public.daybridge_reporting_items where user_id=p_actor and court_id=v_court and category=v_category;
  perform daybridge_private.reconcile_reporting(p_actor);
 elsif v_action='share' then
  select * into v_consent from public.daybridge_reporting_consent where user_id=p_actor and court_id=v_court and category=v_category and enabled;
  if not found then raise exception 'Enable this category first' using errcode='42501'; end if;
  if p_input->>'source_kind' not in ('event','task') or v_source is null or length(v_source) not between 1 and 120 then raise exception 'Invalid item'; end if;
  v_history:=coalesce((p_input->>'include_history')::boolean,false);
  v_from:=case when v_history then daybridge_private.reporting_time(p_input->>'history_from') else greatest(now(),v_consent.enabled_at) end;
  if v_from is null or v_from>now() or v_from<now()-interval '366 days' then raise exception 'History start must be within the last year'; end if;
  if (select count(*) from public.daybridge_reporting_items where user_id=p_actor)>=100 then raise exception 'At most 100 individually shared items'; end if;
  if not daybridge_private.reporting_item_eligible(p_actor,p_input->>'source_kind',v_source,v_category) then raise exception 'This item is not eligible for court reporting'; end if;
  insert into public.daybridge_reporting_items(user_id,court_id,source_kind,source_id,source_version,category,consent_revision,share_from,include_history)
   values(p_actor,v_court,p_input->>'source_kind',v_source,daybridge_private.reporting_source_version(p_actor,p_input->>'source_kind',v_source),v_category,v_consent.revision,v_from,v_history)
   on conflict(user_id,court_id,source_kind,source_id) do update set category=excluded.category,source_version=excluded.source_version,consent_revision=excluded.consent_revision,
    share_from=excluded.share_from,include_history=excluded.include_history,selected_at=now();
  -- Only allow real, eligible private items. The helper returns no free text.
  -- Future recurring series may have no recorded occurrence yet; verify source separately below.

  perform daybridge_private.reconcile_reporting(p_actor);
 elsif v_action='unshare' then
  delete from public.daybridge_reporting_items where user_id=p_actor and court_id=v_court and source_kind=p_input->>'source_kind' and source_id=v_source;
  perform daybridge_private.reconcile_reporting(p_actor);
 elsif v_action<>'read' then raise exception 'Unknown reporting action'; end if;
 return jsonb_build_object('enabled',coalesce(v_flag,false),'court_id',v_court,
  'consents',(select coalesce(jsonb_agg(jsonb_build_object('category',category,'enabled',enabled,'enabled_at',enabled_at)),'[]') from public.daybridge_reporting_consent where user_id=p_actor and court_id=v_court),
  'items',(select coalesce(jsonb_agg(jsonb_build_object('source_id',source_id,'source_kind',source_kind,'category',category,'include_history',include_history,'share_from',share_from,'needs_review',source_version is distinct from daybridge_private.reporting_source_version(p_actor,source_kind,source_id))),'[]') from public.daybridge_reporting_items where user_id=p_actor and court_id=v_court),
  'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select id,category,status,scheduled_at,ends_at,reported_at,provenance,first_shared_at,updated_at from public.daybridge_progress_events where user_id=p_actor and court_id=v_court order by updated_at desc limit 500) e),
  'history',(select coalesce(jsonb_agg(to_jsonb(h)),'[]') from (select category,enabled,reason,created_at from public.daybridge_reporting_consent_history where user_id=p_actor and court_id=v_court order by created_at desc limit 100) h));
end;
$$;

create function daybridge_private.reporting_item_eligible(p_user uuid,p_kind text,p_source text,p_category text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.private_snapshots s,
  lateral jsonb_array_elements(daybridge_private.reporting_array(s.payload->'events')) e
  where s.user_id=p_user and ((p_kind='event' and e->>'id'=p_source and
   ((e->>'category'='class' and p_category='class') or (e->>'category' in ('court','case_management') and p_category in ('meeting','check_in','obligation'))))
   or (p_kind='task' and p_category='obligation' and e->>'category' in ('court','case_management') and exists(
    select 1 from jsonb_array_elements(daybridge_private.reporting_array(s.payload->'tasks')) t where t->>'id'=p_source and t->>'linkedEventId'=e->>'id'))));
$$;

-- Owner can configure availability only; this RPC never returns participant data.
create function public.daybridge_owner_reporting(p_actor uuid,p_court uuid,p_enabled boolean default null) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if not daybridge_private.platform_owner(p_actor) then raise exception 'Owner access required' using errcode='42501'; end if;
 if not exists(select 1 from public.daybridge_courts where id=p_court) then raise exception 'Court not found'; end if;
 if p_enabled is not null then
  insert into public.daybridge_reporting_courts(court_id,enabled) values(p_court,p_enabled)
   on conflict(court_id) do update set enabled=excluded.enabled,updated_at=now();
  insert into public.daybridge_court_audit(court_id,actor_id,action) values(p_court,p_actor,case when p_enabled then 'reporting_enabled' else 'reporting_disabled' end);
 end if;
 return coalesce((select enabled from public.daybridge_reporting_courts where court_id=p_court),false);
end;
$$;

create function public.daybridge_staff_progress(p_actor uuid,p_court uuid,p_start timestamptz,p_end timestamptz,
 p_user uuid default null,p_category text default null,p_session uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_events jsonb;v_count integer;v_summary jsonb;v_weekly jsonb;v_monthly jsonb;v_roster jsonb;v_enabled boolean;
begin
 -- Repeat authorization in the DB, even if an API handler has already checked it.
 if daybridge_private.platform_owner(p_actor) or not exists(select 1 from public.daybridge_court_staff s
  join public.daybridge_courts c on c.id=s.court_id and c.enabled
  join public.daybridge_judicial_circuits j on j.id=c.circuit_id
  where s.user_id=p_actor and s.court_id=p_court and s.active and not s.password_change_required
   and (s.credential_valid_after is null or daybridge_private.staff_session_current(p_actor,p_session,s.credential_valid_after))
   and daybridge_private.staff_username(p_actor)||'@'||lower(j.state_code)||'.'||j.login_slug||'.'||c.login_slug=
    daybridge_private.reporting_staff_email(p_actor)) then raise exception 'Court reporting access denied' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '93 days'
  or (p_category is not null and p_category not in ('meeting','class','check_in','obligation')) then raise exception 'Invalid reporting period or category'; end if;
 if p_user is not null and not exists(select 1 from public.daybridge_court_participants where user_id=p_user and court_id=p_court and status<>'removed')
  then raise exception 'Participant not assigned to this court' using errcode='42501'; end if;
 select coalesce((select enabled from public.daybridge_reporting_courts where court_id=p_court),false) into v_enabled;
 if not v_enabled then return jsonb_build_object('enabled',false); end if;
 -- Fail closed if the access audit cannot be committed with this read.
 insert into public.daybridge_report_access_audit(court_id,actor_id,subject_user_id,period_start,period_end,category)
  values(p_court,p_actor,p_user,p_start,p_end,p_category);
 with visible as (
  select e.id,e.user_id,p.username,e.category,e.status,e.scheduled_at,e.ends_at,e.reported_at,e.updated_at,e.provenance
   from public.daybridge_progress_events e join public.daybridge_court_participants p on p.user_id=e.user_id and p.court_id=e.court_id and p.status='active'
   join public.daybridge_reporting_consent c on c.user_id=e.user_id and c.court_id=e.court_id and c.category=e.category and c.enabled and c.revision=e.consent_revision
  where e.court_id=p_court and e.status<>'withdrawn' and coalesce(e.scheduled_at,e.updated_at)>=p_start and coalesce(e.scheduled_at,e.updated_at)<p_end
   and (p_user is null or e.user_id=p_user) and (p_category is null or e.category=p_category)
 ), weekly as (select date_trunc('week',coalesce(scheduled_at,updated_at) at time zone 'UTC') as period,count(*) as shared,count(*) filter(where status='complete') as complete from visible group by 1),
 monthly as (select date_trunc('month',coalesce(scheduled_at,updated_at) at time zone 'UTC') as period,count(*) as shared,count(*) filter(where status='complete') as complete from visible group by 1)
 select (select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select * from visible order by coalesce(scheduled_at,updated_at) desc,id limit 500) e),
 (select count(*) from visible),
 (select jsonb_build_object('shared',count(*),'complete',count(*) filter(where status='complete'),'incomplete',count(*) filter(where status='incomplete'),
  'not_reported',count(*) filter(where status='not_reported' and ends_at<now()),'upcoming',count(*) filter(where status='not_reported' and scheduled_at>=now())) from visible),
 (select coalesce(jsonb_agg(to_jsonb(w) order by period),'[]') from weekly w),
 (select coalesce(jsonb_agg(to_jsonb(m) order by period),'[]') from monthly m)
 into v_events,v_count,v_summary,v_weekly,v_monthly;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_roster from (
  select p.user_id,p.username,p.status,
   (select count(*) from public.daybridge_reporting_consent c where c.user_id=p.user_id and c.court_id=p_court and c.enabled) as sharing_categories,
   (select max(reported_at) from public.daybridge_progress_events e join public.daybridge_reporting_consent c on c.user_id=e.user_id and c.court_id=e.court_id and c.category=e.category and c.enabled and c.revision=e.consent_revision
    where e.user_id=p.user_id and e.court_id=p_court and e.status<>'withdrawn' and p.status='active') as last_reported_at
   from public.daybridge_court_participants p where p.court_id=p_court and p.status<>'removed' and (p_user is null or p.user_id=p_user)
   order by p.username limit 1000) r;
 return jsonb_build_object('enabled',true,'events',v_events,'total_events',v_count,'events_truncated',v_count>500,
  'participants',v_roster,'participants_truncated',(select count(*)>1000 from public.daybridge_court_participants where court_id=p_court and status<>'removed' and (p_user is null or user_id=p_user)),
  'summary',v_summary,'weekly',v_weekly,'monthly',v_monthly,'updated_at',now());
end;
$$;
create function daybridge_private.reporting_staff_email(p_user uuid) returns text
language sql stable security definer set search_path='' as $$ select email from auth.users where id=p_user $$;

-- No helper or RPC is executable by browser roles, including via PUBLIC defaults.
revoke all on function daybridge_private.reporting_time(text,text),daybridge_private.reporting_array(jsonb),
 daybridge_private.reporting_source_version(uuid,text,text),daybridge_private.reporting_candidates(uuid,uuid),daybridge_private.reconcile_reporting(uuid),
 daybridge_private.reporting_snapshot_changed(),daybridge_private.end_reporting(uuid,uuid),
 daybridge_private.reporting_access_changed(),daybridge_private.reporting_court_disabled(),
 daybridge_private.reporting_item_eligible(uuid,text,text,text),daybridge_private.reporting_staff_email(uuid)
 from public,anon,authenticated;
grant execute on function daybridge_private.reporting_source_version(uuid,text,text),daybridge_private.reporting_time(text,text),daybridge_private.reporting_item_eligible(uuid,text,text,text),
 daybridge_private.reconcile_reporting(uuid),daybridge_private.reporting_staff_email(uuid) to service_role;
revoke all on function public.daybridge_participant_reporting(uuid,jsonb),public.daybridge_owner_reporting(uuid,uuid,boolean),
 public.daybridge_staff_progress(uuid,uuid,timestamptz,timestamptz,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.daybridge_participant_reporting(uuid,jsonb),public.daybridge_owner_reporting(uuid,uuid,boolean),
 public.daybridge_staff_progress(uuid,uuid,timestamptz,timestamptz,uuid,text,uuid) to service_role;
