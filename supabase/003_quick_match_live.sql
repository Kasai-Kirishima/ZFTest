-- Zero Football v62: automatic 30-second matchmaking and synchronized 10-event matches.
-- Run after 001_cloud_saves.sql and 002_multiplayer.sql.

create table if not exists public.zf_matchmaking_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  club_snapshot jsonb not null,
  status text not null default 'waiting' check (status in ('waiting','matched')),
  room_id uuid references public.zf_multiplayer_rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zf_matchmaking_queue_waiting_idx
  on public.zf_matchmaking_queue (created_at)
  where status = 'waiting';

alter table public.zf_matchmaking_queue enable row level security;
grant select on public.zf_matchmaking_queue to authenticated;
drop policy if exists "Players can read their own matchmaking entry" on public.zf_matchmaking_queue;
create policy "Players can read their own matchmaking entry"
  on public.zf_matchmaking_queue for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.zf_join_matchmaking(p_club jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.zf_matchmaking_queue;
  v_waiting public.zf_matchmaking_queue;
  v_room public.zf_multiplayer_rooms;
  v_code text;
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if p_club is null or jsonb_typeof(p_club) <> 'object' then raise exception 'Не удалось прочитать данные клуба.'; end if;

  -- Serialize queue joins so two searches started at the same time cannot both miss each other.
  perform pg_advisory_xact_lock(hashtext('zf_matchmaking_global'));

  select * into v_existing from public.zf_matchmaking_queue where user_id = v_user_id for update;
  if found and v_existing.status = 'matched' and v_existing.room_id is not null then
    select * into v_room from public.zf_multiplayer_rooms where id = v_existing.room_id;
    if found and v_room.status in ('playing','finished') then
      return jsonb_build_object('status','matched','room_id',v_room.id);
    end if;
  end if;

  delete from public.zf_matchmaking_queue where created_at < now() - interval '2 minutes';
  delete from public.zf_matchmaking_queue where user_id = v_user_id;

  select * into v_waiting
  from public.zf_matchmaking_queue q
  where q.status = 'waiting'
    and q.user_id <> v_user_id
    and q.created_at > now() - interval '45 seconds'
  order by q.created_at asc
  limit 1
  for update skip locked;

  if found then
    loop
      v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
      exit when not exists (select 1 from public.zf_multiplayer_rooms r where r.room_code = v_code);
    end loop;

    insert into public.zf_multiplayer_rooms
      (room_code,host_user_id,guest_user_id,host_club,guest_club,is_public,status,game_state)
    values
      (v_code,v_waiting.user_id,v_user_id,v_waiting.club_snapshot,p_club,false,'playing',
       jsonb_build_object('mode','quick_match','event_index',0,'events','[]'::jsonb,
         'score',jsonb_build_object('host',0,'guest',0),'choices','{}'::jsonb,'log','[]'::jsonb))
    returning * into v_room;

    update public.zf_matchmaking_queue
      set status = 'matched', room_id = v_room.id, updated_at = now()
      where user_id = v_waiting.user_id;
    insert into public.zf_matchmaking_queue(user_id,club_snapshot,status,room_id)
      values(v_user_id,p_club,'matched',v_room.id);
    return jsonb_build_object('status','matched','room_id',v_room.id);
  end if;

  insert into public.zf_matchmaking_queue(user_id,club_snapshot,status,room_id)
    values(v_user_id,p_club,'waiting',null);
  return jsonb_build_object('status','waiting');
end;
$$;
revoke all on function public.zf_join_matchmaking(jsonb) from public;
grant execute on function public.zf_join_matchmaking(jsonb) to authenticated;

create or replace function public.zf_matchmaking_status()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid(); v_entry public.zf_matchmaking_queue;
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  select * into v_entry from public.zf_matchmaking_queue where user_id = v_user_id;
  if not found then return jsonb_build_object('status','none'); end if;
  return jsonb_build_object('status',v_entry.status,'room_id',v_entry.room_id,'created_at',v_entry.created_at);
end;
$$;
revoke all on function public.zf_matchmaking_status() from public;
grant execute on function public.zf_matchmaking_status() to authenticated;

create or replace function public.zf_cancel_matchmaking()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  delete from public.zf_matchmaking_queue where user_id = v_user_id and status = 'waiting';
  return jsonb_build_object('cancelled',true);
end;
$$;
revoke all on function public.zf_cancel_matchmaking() from public;
grant execute on function public.zf_cancel_matchmaking() to authenticated;

create or replace function public.zf_initialize_live_match(p_room_id uuid,p_events jsonb)
returns public.zf_multiplayer_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid(); v_room public.zf_multiplayer_rooms; v_state jsonb;
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or coalesce(jsonb_array_length(p_events),0) <> 10 then raise exception 'Матч должен содержать 10 событий.'; end if;
  select * into v_room from public.zf_multiplayer_rooms where id = p_room_id for update;
  if not found then raise exception 'Матч не найден.'; end if;
  if v_room.host_user_id <> v_user_id then raise exception 'Подготовить матч может только первый подключившийся игрок.'; end if;
  if v_room.status <> 'playing' then raise exception 'Матч уже не ожидает запуска.'; end if;
  if jsonb_typeof(v_room.game_state->'events') = 'array' and jsonb_array_length(v_room.game_state->'events') > 0 then return v_room; end if;
  v_state := jsonb_build_object('mode','quick_match','event_index',0,'events',p_events,
    'score',jsonb_build_object('host',0,'guest',0),'choices','{}'::jsonb,'log','[]'::jsonb);
  update public.zf_multiplayer_rooms set game_state = v_state, updated_at = now()
    where id = p_room_id returning * into v_room;
  return v_room;
end;
$$;
revoke all on function public.zf_initialize_live_match(uuid,jsonb) from public;
grant execute on function public.zf_initialize_live_match(uuid,jsonb) to authenticated;

create or replace function public.zf_submit_live_match_action(p_room_id uuid,p_expected_event integer,p_role text,p_choice text)
returns public.zf_multiplayer_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.zf_multiplayer_rooms;
  v_state jsonb;
  v_events jsonb;
  v_event jsonb;
  v_choices jsonb;
  v_log jsonb;
  v_index integer;
  v_attacker_role text;
  v_expected_role text;
  v_attacker_choice text;
  v_defender_choice text;
  v_attacker_id uuid;
  v_goal boolean := false;
  v_finished boolean := false;
  v_base numeric := 0.12;
  v_modifier numeric := 0;
  v_score_host integer;
  v_score_guest integer;
  v_kind text;
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if p_role is null or p_role not in ('attack','defend') then raise exception 'Неизвестная роль игрока.'; end if;
  if p_expected_event is null or p_choice is null or length(p_choice) > 40 then raise exception 'Некорректное игровое решение.'; end if;
  select * into v_room from public.zf_multiplayer_rooms where id = p_room_id for update;
  if not found then raise exception 'Матч не найден.'; end if;
  if v_room.host_user_id <> v_user_id and v_room.guest_user_id <> v_user_id then raise exception 'Ты не участник этого матча.'; end if;
  if v_room.status <> 'playing' then raise exception 'Матч уже завершён.'; end if;
  v_state := v_room.game_state;
  v_events := v_state->'events';
  v_index := coalesce((v_state->>'event_index')::integer,0);
  if v_index <> p_expected_event then raise exception 'Это событие уже изменилось. Обновляем матч.'; end if;
  if jsonb_typeof(v_events) <> 'array' or v_index >= jsonb_array_length(v_events) then raise exception 'События матча не подготовлены.'; end if;
  v_event := v_events->v_index;
  v_attacker_role := case when mod(v_index,2)=0 then 'host' else 'guest' end;
  v_expected_role := case when (v_attacker_role='host' and v_room.host_user_id=v_user_id) or (v_attacker_role='guest' and v_room.guest_user_id=v_user_id) then 'attack' else 'defend' end;
  if p_role <> v_expected_role then raise exception 'Сейчас ход соперника.'; end if;
  if p_role='attack' then
    if (coalesce(v_event->'attackChoices','[]'::jsonb) ? p_choice) is not true then raise exception 'Недопустимый вариант атаки.'; end if;
  else
    if (coalesce(v_event->'defenseChoices','[]'::jsonb) ? p_choice) is not true then raise exception 'Недопустимый вариант защиты.'; end if;
  end if;

  v_choices := coalesce(v_state->'choices','{}'::jsonb);
  if v_choices ? p_role then raise exception 'Твоё решение уже принято. Ждём второго игрока.'; end if;
  v_choices := jsonb_set(v_choices,array[p_role],to_jsonb(p_choice),true);
  if not (v_choices ? 'attack' and v_choices ? 'defend') then
    v_state := jsonb_set(v_state,'{choices}',v_choices,true);
    update public.zf_multiplayer_rooms set game_state=v_state,updated_at=now() where id=p_room_id returning * into v_room;
    return v_room;
  end if;

  v_attacker_choice := v_choices->>'attack';
  v_defender_choice := v_choices->>'defend';
  v_kind := coalesce(v_event->>'kind','open_play');
  if v_kind='penalty' then
    v_goal := v_attacker_choice <> v_defender_choice;
  else
    v_base := case
      when v_attacker_choice in ('shot','finish','longshot') then 0.43
      when v_attacker_choice in ('through','fast-break','cutback','cross','dribble') then 0.27
      when v_attacker_choice in ('safe-pass','hold','switch-play','switch','pass','one-two') then 0.12
      else 0.17 end;
    v_modifier := case
      when v_defender_choice in ('block','double','clear','intercept') then -0.11
      when v_defender_choice in ('press','tackle','counterpress') then -0.07
      when v_defender_choice in ('offside') then -0.09
      else -0.02 end;
    v_goal := random() < greatest(0.035,least(0.58,v_base+v_modifier));
  end if;

  v_score_host := coalesce((v_state->'score'->>'host')::integer,0);
  v_score_guest := coalesce((v_state->'score'->>'guest')::integer,0);
  v_attacker_id := case when v_attacker_role='host' then v_room.host_user_id else v_room.guest_user_id end;
  if v_goal and v_attacker_role='host' then v_score_host := v_score_host+1; end if;
  if v_goal and v_attacker_role='guest' then v_score_guest := v_score_guest+1; end if;
  v_log := coalesce(v_state->'log','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'event',v_index+1,'minute',v_event->>'minute','title',v_event->>'title','kind',v_kind,
    'attacker_role',v_attacker_role,'attack_choice',v_attacker_choice,'defense_choice',v_defender_choice,'goal',v_goal));
  v_index := v_index+1;
  v_finished := v_index >= jsonb_array_length(v_events);
  v_state := jsonb_set(v_state,'{event_index}',to_jsonb(v_index),true);
  v_state := jsonb_set(v_state,'{score}',jsonb_build_object('host',v_score_host,'guest',v_score_guest),true);
  v_state := jsonb_set(v_state,'{choices}','{}'::jsonb,true);
  v_state := jsonb_set(v_state,'{log}',v_log,true);
  v_state := jsonb_set(v_state,'{last_result}',jsonb_build_object('event',v_index-1,'goal',v_goal,'attacker_role',v_attacker_role,'title',v_event->>'title'),true);
  update public.zf_multiplayer_rooms set game_state=v_state,status=case when v_finished then 'finished' else 'playing' end,updated_at=now()
    where id=p_room_id returning * into v_room;
  return v_room;
end;
$$;
revoke all on function public.zf_submit_live_match_action(uuid,integer,text,text) from public;
grant execute on function public.zf_submit_live_match_action(uuid,integer,text,text) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='zf_multiplayer_rooms') then
    alter publication supabase_realtime add table public.zf_multiplayer_rooms;
  end if;
end $$;
