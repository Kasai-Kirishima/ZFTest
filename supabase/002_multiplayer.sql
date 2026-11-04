-- Zero Football v61: authenticated online rooms and synchronized penalty shootouts.
-- Run after 001_cloud_saves.sql in Supabase SQL Editor.

create table if not exists public.zf_multiplayer_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete set null,
  host_club jsonb not null,
  guest_club jsonb,
  is_public boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting','ready','playing','finished')),
  game_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zf_room_distinct_players check (guest_user_id is null or guest_user_id <> host_user_id)
);

create index if not exists zf_multiplayer_waiting_public_idx
  on public.zf_multiplayer_rooms (created_at desc)
  where status = 'waiting' and is_public = true;

alter table public.zf_multiplayer_rooms enable row level security;
grant select, insert on table public.zf_multiplayer_rooms to authenticated;

drop policy if exists "Room participants and public waiting rooms can be read" on public.zf_multiplayer_rooms;
create policy "Room participants and public waiting rooms can be read"
  on public.zf_multiplayer_rooms for select to authenticated
  using (
    host_user_id = (select auth.uid())
    or guest_user_id = (select auth.uid())
    or (is_public = true and status = 'waiting')
  );

drop policy if exists "Players create their own rooms" on public.zf_multiplayer_rooms;
create policy "Players create their own rooms"
  on public.zf_multiplayer_rooms for insert to authenticated
  with check (
    host_user_id = (select auth.uid())
    and guest_user_id is null
    and status = 'waiting'
  );

drop policy if exists "Room participants update their room" on public.zf_multiplayer_rooms;
-- Room state changes are performed through SECURITY DEFINER RPCs below, not direct client UPDATEs.

drop policy if exists "Room host can delete room" on public.zf_multiplayer_rooms;
create policy "Room host can delete room"
  on public.zf_multiplayer_rooms for delete to authenticated
  using (host_user_id = (select auth.uid()));

-- Joining is done through a function so two users cannot claim the same room at once.
create or replace function public.zf_join_room(p_room_code text, p_guest_club jsonb)
returns public.zf_multiplayer_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.zf_multiplayer_rooms;
begin
  if v_user_id is null then
    raise exception 'Необходимо войти в аккаунт.';
  end if;

  select * into v_room
  from public.zf_multiplayer_rooms
  where room_code = upper(trim(p_room_code))
  for update;

  if not found then
    raise exception 'Комната не найдена.';
  end if;

  if v_room.host_user_id = v_user_id or v_room.guest_user_id = v_user_id then
    return v_room;
  end if;

  if v_room.status <> 'waiting' or v_room.guest_user_id is not null then
    raise exception 'Комната уже занята.';
  end if;

  update public.zf_multiplayer_rooms
  set guest_user_id = v_user_id,
      guest_club = p_guest_club,
      status = 'ready',
      updated_at = now()
  where id = v_room.id
  returning * into v_room;

  return v_room;
end;
$$;

revoke all on function public.zf_join_room(text, jsonb) from public;
grant execute on function public.zf_join_room(text, jsonb) to authenticated;

-- Only the room host can start a room after the guest has joined.
create or replace function public.zf_start_room(p_room_id uuid)
returns public.zf_multiplayer_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.zf_multiplayer_rooms;
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  select * into v_room from public.zf_multiplayer_rooms where id = p_room_id for update;
  if not found then raise exception 'Комната не найдена.'; end if;
  if v_room.host_user_id <> v_user_id then raise exception 'Начать матч может только создатель комнаты.'; end if;
  if v_room.status <> 'ready' or v_room.guest_user_id is null then raise exception 'Ожидаем подключения второго игрока.'; end if;
  update public.zf_multiplayer_rooms
  set status = 'playing',
      game_state = jsonb_build_object('round',1,'phase','shoot','score',jsonb_build_object('host',0,'guest',0),'shooter_choice',null,'log','[]'::jsonb),
      updated_at = now()
  where id = p_room_id
  returning * into v_room;
  return v_room;
end;
$$;

revoke all on function public.zf_start_room(uuid) from public;
grant execute on function public.zf_start_room(uuid) to authenticated;

-- A host closes the room; a guest leaves it and frees the guest slot.
create or replace function public.zf_leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.zf_multiplayer_rooms;
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  select * into v_room from public.zf_multiplayer_rooms where id = p_room_id for update;
  if not found then return jsonb_build_object('deleted', true); end if;
  if v_room.host_user_id = v_user_id then
    delete from public.zf_multiplayer_rooms where id = p_room_id;
    return jsonb_build_object('deleted', true);
  elsif v_room.guest_user_id = v_user_id then
    update public.zf_multiplayer_rooms
    set guest_user_id = null, guest_club = null, status = 'waiting', game_state = '{}'::jsonb, updated_at = now()
    where id = p_room_id returning * into v_room;
    return jsonb_build_object('deleted', false, 'room', to_jsonb(v_room));
  end if;
  raise exception 'Ты не участник этой комнаты.';
end;
$$;

revoke all on function public.zf_leave_room(uuid) from public;
grant execute on function public.zf_leave_room(uuid) to authenticated;

-- Each round: one player chooses a shot lane, the other chooses a save lane.
-- Five shots per player (ten total). The function validates whose turn it is and updates atomically.
drop function if exists public.zf_submit_penalty_action(uuid, text);
create or replace function public.zf_submit_penalty_action(p_room_id uuid, p_expected_round integer, p_expected_phase text, p_choice text)
returns public.zf_multiplayer_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.zf_multiplayer_rooms;
  v_state jsonb;
  v_round integer;
  v_phase text;
  v_shooter_role text;
  v_shooter_id uuid;
  v_keeper_id uuid;
  v_shot text;
  v_score_host integer;
  v_score_guest integer;
  v_log jsonb;
  v_goal boolean;
  v_shooter_name text;
  v_finished boolean := false;
begin
  if v_user_id is null then
    raise exception 'Необходимо войти в аккаунт.';
  end if;
  if p_choice not in ('left','center','right') then
    raise exception 'Недопустимое направление.';
  end if;

  select * into v_room
  from public.zf_multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then raise exception 'Комната не найдена.'; end if;
  if v_room.status <> 'playing' then raise exception 'Матч сейчас не принимает ходы.'; end if;
  if v_user_id not in (v_room.host_user_id, v_room.guest_user_id) then
    raise exception 'Ты не участник этой комнаты.';
  end if;

  v_state := coalesce(v_room.game_state, '{}'::jsonb);
  v_round := coalesce((v_state->>'round')::integer, 1);
  v_phase := coalesce(v_state->>'phase', 'shoot');
  v_score_host := coalesce((v_state->'score'->>'host')::integer, 0);
  v_score_guest := coalesce((v_state->'score'->>'guest')::integer, 0);
  v_log := coalesce(v_state->'log', '[]'::jsonb);

  if v_round > 10 then raise exception 'Серия уже завершена.'; end if;
  if v_round <> p_expected_round or v_phase <> p_expected_phase then raise exception 'Ход уже изменился. Обнови комнату.'; end if;

  v_shooter_role := case when mod(v_round, 2) = 1 then 'host' else 'guest' end;
  v_shooter_id := case when v_shooter_role = 'host' then v_room.host_user_id else v_room.guest_user_id end;
  v_keeper_id := case when v_shooter_role = 'host' then v_room.guest_user_id else v_room.host_user_id end;
  v_shooter_name := case when v_shooter_role = 'host' then coalesce(v_room.host_club->>'name','Хозяева') else coalesce(v_room.guest_club->>'name','Гости') end;

  if v_phase = 'shoot' then
    if v_user_id <> v_shooter_id then raise exception 'Сейчас очередь соперника бить.'; end if;
    v_state := jsonb_set(v_state, '{phase}', '"save"'::jsonb, true);
    v_state := jsonb_set(v_state, '{shooter_choice}', to_jsonb(p_choice), true);
    v_state := jsonb_set(v_state, '{shooter_role}', to_jsonb(v_shooter_role), true);
  elsif v_phase = 'save' then
    if v_user_id <> v_keeper_id then raise exception 'Сейчас очередь соперника защищаться.'; end if;
    v_shot := v_state->>'shooter_choice';
    v_goal := v_shot <> p_choice;
    if v_goal and v_shooter_role = 'host' then v_score_host := v_score_host + 1; end if;
    if v_goal and v_shooter_role = 'guest' then v_score_guest := v_score_guest + 1; end if;
    v_log := v_log || jsonb_build_array(jsonb_build_object(
      'round', v_round,
      'shooter_role', v_shooter_role,
      'shooter_name', v_shooter_name,
      'shot', v_shot,
      'save', p_choice,
      'goal', v_goal
    ));
    v_round := v_round + 1;
    v_finished := v_round > 10;
    v_state := jsonb_set(v_state, '{round}', to_jsonb(v_round), true);
    v_state := jsonb_set(v_state, '{phase}', to_jsonb(case when v_finished then 'finished' else 'shoot' end), true);
    v_state := jsonb_set(v_state, '{score}', jsonb_build_object('host',v_score_host,'guest',v_score_guest), true);
    v_state := jsonb_set(v_state, '{shooter_choice}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{log}', v_log, true);
    v_state := jsonb_set(v_state, '{last_round}', to_jsonb(v_round - 1), true);
  else
    raise exception 'Неизвестная фаза матча.';
  end if;

  update public.zf_multiplayer_rooms
  set game_state = v_state,
      status = case when v_finished then 'finished' else status end,
      updated_at = now()
  where id = v_room.id
  returning * into v_room;

  return v_room;
end;
$$;

revoke all on function public.zf_submit_penalty_action(uuid, integer, text, text) from public;
grant execute on function public.zf_submit_penalty_action(uuid, integer, text, text) to authenticated;

-- Enable row-change notifications for the room UI. Safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'zf_multiplayer_rooms'
  ) then
    alter publication supabase_realtime add table public.zf_multiplayer_rooms;
  end if;
end $$;
