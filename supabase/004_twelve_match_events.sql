-- Zero Football v66: allow 12-episode quick matches while preserving 10-event compatibility.
-- Run once after 003_quick_match_live.sql in Supabase SQL Editor.

create or replace function public.zf_initialize_live_match(p_room_id uuid,p_events jsonb)
returns public.zf_multiplayer_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid(); v_room public.zf_multiplayer_rooms; v_state jsonb;
begin
  if v_user_id is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or coalesce(jsonb_array_length(p_events),0) not in (10,12) then raise exception 'Матч должен содержать 10 или 12 событий.'; end if;
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

