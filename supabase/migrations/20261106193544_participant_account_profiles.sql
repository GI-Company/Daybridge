-- Court registration details only. Existing accounts keep their usernames and
-- may have no recorded name/birthday; never infer or backfill personal data.
alter table public.daybridge_court_participants
 add column participant_name text check (
  participant_name is null or (length(trim(participant_name)) between 2 and 120
   and participant_name !~ '[[:cntrl:]]')
 ),
 add column birth_date date check (birth_date is null or
  (isfinite(birth_date) and birth_date >= date '0001-01-01'));

-- Reuse the existing staff/password, court, subscription, seat-lock and unique
-- username enforcement. Profile and assignment commit together or roll back.
-- No name/birthday uniqueness rule: different participants may share them.
create function public.daybridge_assign_participant_profile(
 p_court_id uuid,p_user_id uuid,p_username text,p_actor_id uuid,
 p_participant_name text,p_birth_date date
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_participant_name is null or length(trim(p_participant_name)) not between 2 and 120
  or p_participant_name ~ '[[:cntrl:]]' then
  raise exception 'Enter the participant full name';
 end if;
 if p_birth_date is null or not isfinite(p_birth_date)
  or p_birth_date < date '0001-01-01' or p_birth_date > current_date then
  raise exception 'Enter a valid date of birth';
 end if;
 if p_username is null or p_username !~ '^[a-z]{4}[0-9]{4}$' then
  raise exception 'Invalid generated username';
 end if;
 perform public.daybridge_assign_participant(p_court_id,p_user_id,p_username,p_actor_id);
 update public.daybridge_court_participants
 set participant_name=trim(p_participant_name),birth_date=p_birth_date
 where user_id=p_user_id and court_id=p_court_id;
end;
$$;
revoke all on function public.daybridge_assign_participant_profile(uuid,uuid,text,uuid,text,date)
 from public,anon,authenticated;
grant execute on function public.daybridge_assign_participant_profile(uuid,uuid,text,uuid,text,date)
 to service_role;
