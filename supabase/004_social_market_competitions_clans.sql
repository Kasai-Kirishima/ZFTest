-- Zero Football v66: social graph, card escrow, transfer market, clans and competitions.
-- Run after migrations 001, 002 and 003 in Supabase SQL Editor.
-- All state-changing operations below use SECURITY DEFINER RPCs and auth.uid().

create table if not exists public.zf_player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  display_name text not null default 'Игрок',
  club_name text not null default 'Без клуба',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.zf_recent_opponents (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  last_played_at timestamptz not null default now(),
  matches_played integer not null default 1 check(matches_played>0),
  primary key(user_a,user_b),
  check(user_a<user_b)
);
alter table public.zf_recent_opponents enable row level security;
grant select on public.zf_recent_opponents to authenticated;
DO $$ BEGIN
  create policy "recent opponents visible to participants" on public.zf_recent_opponents for select to authenticated using (auth.uid()=user_a or auth.uid()=user_b);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create or replace function public.zf_social_record_recent_opponent(p_other uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a uuid; b uuid;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_other is null or p_other=u then return jsonb_build_object('recorded',false); end if;
 if not exists(select 1 from public.zf_player_profiles where user_id=p_other) then return jsonb_build_object('recorded',false); end if;
 a:=least(u,p_other); b:=greatest(u,p_other);
 insert into public.zf_recent_opponents(user_a,user_b,last_played_at,matches_played) values(a,b,now(),1)
 on conflict(user_a,user_b) do update set last_played_at=now(),matches_played=public.zf_recent_opponents.matches_played+1;
 return jsonb_build_object('recorded',true);
end $$;
revoke all on function public.zf_social_record_recent_opponent(uuid) from public; grant execute on function public.zf_social_record_recent_opponent(uuid) to authenticated;

create table if not exists public.zf_contacts (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','acquaintance','friend')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_a,user_b),
  check(user_a < user_b),
  check(requested_by=user_a or requested_by=user_b),
  check(user_a<>user_b)
);

create table if not exists public.zf_trade_offers (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  offered_card jsonb not null,
  requested_card_hint text,
  counter_card jsonb,
  message text not null default '',
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
  sender_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(from_user_id<>to_user_id)
);
create index if not exists zf_trade_inbox_idx on public.zf_trade_offers(to_user_id,status,created_at desc);
create index if not exists zf_trade_outbox_idx on public.zf_trade_offers(from_user_id,status,created_at desc);

create table if not exists public.zf_market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  card_snapshot jsonb not null,
  card_name text not null,
  card_rating integer not null check(card_rating between 1 and 99),
  price_coins numeric(14,2) not null check(price_coins>0),
  is_duplicate boolean not null default false,
  status text not null default 'active' check(status in ('active','sold','withdrawn')),
  seller_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(buyer_user_id is null or buyer_user_id<>seller_user_id)
);
create index if not exists zf_market_active_idx on public.zf_market_listings(status,card_name,card_rating desc,price_coins asc);
create index if not exists zf_market_seller_idx on public.zf_market_listings(seller_user_id,status,created_at desc);

create table if not exists public.zf_market_proceeds (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.zf_market_listings(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check(amount>0),
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(listing_id)
);

create table if not exists public.zf_clans (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(name) between 3 and 24),
  tag text not null unique check(tag ~ '^[A-Z0-9]{2,5}$'),
  description text not null default '',
  level integer not null default 1 check(level between 1 and 100),
  xp integer not null default 0 check(xp>=0),
  created_at timestamptz not null default now()
);
create table if not exists public.zf_clan_members (
  clan_id uuid not null references public.zf_clans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','officer','member')),
  joined_at timestamptz not null default now(),
  primary key(clan_id,user_id),
  unique(user_id)
);
create table if not exists public.zf_clan_applications (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.zf_clans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique(clan_id,user_id)
);
create table if not exists public.zf_clan_missions (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.zf_clans(id) on delete cascade,
  title text not null,
  description text not null,
  target integer not null check(target>0),
  progress integer not null default 0 check(progress>=0),
  reward_xp integer not null default 100 check(reward_xp>0),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.zf_competitions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(title) between 3 and 40),
  kind text not null check(kind in ('league','tournament')),
  max_players integer not null default 16 check(max_players between 2 and 64),
  draw_mode text not null default 'random' check(draw_mode in ('random','manual')),
  reward jsonb not null default '{"type":"none"}'::jsonb,
  status text not null default 'open' check(status in ('open','locked','finished','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.zf_competition_members (
  competition_id uuid not null references public.zf_competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  seed integer,
  primary key(competition_id,user_id)
);
create table if not exists public.zf_competition_invites (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.zf_competitions(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(competition_id,invited_user_id)
);
create table if not exists public.zf_competition_matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.zf_competitions(id) on delete cascade,
  round_no integer not null default 1,
  match_no integer not null,
  home_user_id uuid references auth.users(id) on delete set null,
  away_user_id uuid references auth.users(id) on delete set null,
  home_score integer,
  away_score integer,
  status text not null default 'scheduled' check(status in ('scheduled','playing','finished','bye')),
  created_at timestamptz not null default now(),
  unique(competition_id,round_no,match_no)
);

-- Read access is deliberately narrow. Mutations are RPC-only.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['zf_player_profiles','zf_recent_opponents','zf_contacts','zf_trade_offers','zf_market_listings','zf_market_proceeds','zf_clans','zf_clan_members','zf_clan_applications','zf_clan_missions','zf_competitions','zf_competition_members','zf_competition_invites','zf_competition_matches'] LOOP
    EXECUTE format('alter table public.%I enable row level security',t);
  END LOOP;
END $$;

grant select on public.zf_player_profiles,public.zf_recent_opponents,public.zf_contacts,public.zf_trade_offers,public.zf_market_listings,public.zf_clans,public.zf_clan_members,public.zf_clan_applications,public.zf_clan_missions,public.zf_competitions,public.zf_competition_members,public.zf_competition_invites,public.zf_competition_matches to authenticated;

-- Social profile: create-on-first-use; player code is stable and safe to share.
create or replace function public.zf_social_profile(p_display_name text,p_club_name text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); p public.zf_player_profiles;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 insert into public.zf_player_profiles(user_id,display_name,club_name) values(u,left(coalesce(nullif(trim(p_display_name),''),'Игрок'),32),left(coalesce(nullif(trim(p_club_name),''),'Без клуба'),32))
 on conflict(user_id) do update set display_name=excluded.display_name,club_name=excluded.club_name,updated_at=now();
 select * into p from public.zf_player_profiles where user_id=u;
 return to_jsonb(p);
end $$;
revoke all on function public.zf_social_profile(text,text) from public; grant execute on function public.zf_social_profile(text,text) to authenticated;

create or replace function public.zf_social_search_player(p_code text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.zf_player_profiles;
begin
 if auth.uid() is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into p from public.zf_player_profiles where player_code=upper(trim(p_code));
 if not found then raise exception 'Игрок с таким ID не найден.'; end if;
 return jsonb_build_object('user_id',p.user_id,'player_code',p.player_code,'display_name',p.display_name,'club_name',p.club_name);
end $$;
revoke all on function public.zf_social_search_player(text) from public; grant execute on function public.zf_social_search_player(text) to authenticated;

create or replace function public.zf_social_send_request(p_code text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); target uuid; a uuid; b uuid;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select user_id into target from public.zf_player_profiles where player_code=upper(trim(p_code));
 if target is null then raise exception 'Игрок с таким ID не найден.'; end if;
 if target=u then raise exception 'Нельзя добавить самого себя.'; end if;
 a:=least(u,target); b:=greatest(u,target);
 insert into public.zf_contacts(user_a,user_b,status,requested_by) values(a,b,'pending',u)
 on conflict(user_a,user_b) do update set status='pending',requested_by=u,updated_at=now()
 where public.zf_contacts.status='pending' and public.zf_contacts.requested_by<>u;
 if not found then raise exception 'Заявка уже существует или игрок уже в контактах.'; end if;
 return jsonb_build_object('sent',true);
end $$;
revoke all on function public.zf_social_send_request(text) from public; grant execute on function public.zf_social_send_request(text) to authenticated;

create or replace function public.zf_social_decide_request(p_other uuid,p_accept boolean,p_status text default 'friend')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a uuid; b uuid; r public.zf_contacts;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_status not in ('friend','acquaintance') then raise exception 'Некорректный тип контакта.'; end if;
 a:=least(u,p_other); b:=greatest(u,p_other);
 select * into r from public.zf_contacts where user_a=a and user_b=b for update;
 if not found or r.status<>'pending' or r.requested_by=u then raise exception 'Входящая заявка не найдена.'; end if;
 if p_accept then update public.zf_contacts set status=p_status,updated_at=now() where user_a=a and user_b=b; else delete from public.zf_contacts where user_a=a and user_b=b; end if;
 return jsonb_build_object('accepted',p_accept,'status',case when p_accept then p_status else 'removed' end);
end $$;
revoke all on function public.zf_social_decide_request(uuid,boolean,text) from public; grant execute on function public.zf_social_decide_request(uuid,boolean,text) to authenticated;

create or replace function public.zf_social_set_contact(p_other uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a uuid; b uuid;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_status not in ('friend','acquaintance') then raise exception 'Некорректный статус.'; end if;
 a:=least(u,p_other); b:=greatest(u,p_other);
 update public.zf_contacts set status=p_status,updated_at=now() where user_a=a and user_b=b and status in ('friend','acquaintance');
 if not found then raise exception 'Контакт не найден.'; end if;
 return jsonb_build_object('updated',true,'status',p_status);
end $$;
revoke all on function public.zf_social_set_contact(uuid,text) from public; grant execute on function public.zf_social_set_contact(uuid,text) to authenticated;

create or replace function public.zf_social_remove_contact(p_other uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a uuid; b uuid;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 a:=least(u,p_other); b:=greatest(u,p_other);
 delete from public.zf_contacts where user_a=a and user_b=b and status<>'pending';
 return jsonb_build_object('removed',true);
end $$;
revoke all on function public.zf_social_remove_contact(uuid) from public; grant execute on function public.zf_social_remove_contact(uuid) to authenticated;

create or replace function public.zf_social_contacts()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); contacts jsonb; incoming jsonb; outgoing jsonb; recent jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'player_code',p.player_code,'display_name',p.display_name,'club_name',p.club_name,'status',c.status) order by p.display_name),'[]'::jsonb) into contacts
 from public.zf_contacts c join public.zf_player_profiles p on p.user_id=case when c.user_a=u then c.user_b else c.user_a end
 where (c.user_a=u or c.user_b=u) and c.status in ('friend','acquaintance');
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'player_code',p.player_code,'display_name',p.display_name,'club_name',p.club_name,'created_at',c.created_at) order by c.created_at desc),'[]'::jsonb) into incoming
 from public.zf_contacts c join public.zf_player_profiles p on p.user_id=c.requested_by
 where (c.user_a=u or c.user_b=u) and c.status='pending' and c.requested_by<>u;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'player_code',p.player_code,'display_name',p.display_name,'club_name',p.club_name,'created_at',c.created_at) order by c.created_at desc),'[]'::jsonb) into outgoing
 from public.zf_contacts c join public.zf_player_profiles p on p.user_id=case when c.user_a=u then c.user_b else c.user_a end
 where (c.user_a=u or c.user_b=u) and c.status='pending' and c.requested_by=u;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'player_code',p.player_code,'display_name',p.display_name,'club_name',p.club_name,'last_played_at',r.last_played_at,'matches_played',r.matches_played) order by r.last_played_at desc),'[]'::jsonb) into recent
 from public.zf_recent_opponents r join public.zf_player_profiles p on p.user_id=case when r.user_a=u then r.user_b else r.user_a end where r.user_a=u or r.user_b=u;
 return jsonb_build_object('contacts',contacts,'incoming',incoming,'outgoing',outgoing,'recent',recent);
end $$;
revoke all on function public.zf_social_contacts() from public; grant execute on function public.zf_social_contacts() to authenticated;

-- Card offers are kept server-side until accepted/rejected. A sender may claim a returned card exactly once.
create or replace function public.zf_trade_create(p_to uuid,p_card jsonb,p_requested_hint text default null,p_message text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_trade_offers;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_to=u or p_card is null or jsonb_typeof(p_card)<>'object' then raise exception 'Некорректное предложение.'; end if;
 if not exists(select 1 from public.zf_contacts where user_a=least(u,p_to) and user_b=greatest(u,p_to) and status in ('friend','acquaintance')) then raise exception 'Обмен доступен только знакомым и друзьям.'; end if;
 if not exists(select 1 from public.zf_player_profiles where user_id=p_to) then raise exception 'Профиль получателя не найден.'; end if;
 insert into public.zf_trade_offers(from_user_id,to_user_id,offered_card,requested_card_hint,message)
 values(u,p_to,p_card,left(coalesce(p_requested_hint,''),80),left(coalesce(p_message,''),180)) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.zf_trade_create(uuid,jsonb,text,text) from public; grant execute on function public.zf_trade_create(uuid,jsonb,text,text) to authenticated;

create or replace function public.zf_trade_decide(p_offer uuid,p_accept boolean,p_counter_card jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_trade_offers;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into r from public.zf_trade_offers where id=p_offer for update;
 if not found or r.to_user_id<>u then raise exception 'Предложение не найдено.'; end if;
 if r.status<>'pending' then raise exception 'Предложение уже обработано.'; end if;
 if p_accept and length(coalesce(r.requested_card_hint,''))>0 and (p_counter_card is null or jsonb_typeof(p_counter_card)<>'object') then raise exception 'Выбери карточку для обмена.'; end if;
 if p_accept then update public.zf_trade_offers set status='accepted',counter_card=p_counter_card,updated_at=now() where id=p_offer returning * into r;
 else update public.zf_trade_offers set status='declined',updated_at=now() where id=p_offer returning * into r; end if;
 return jsonb_build_object('offer',to_jsonb(r));
end $$;
revoke all on function public.zf_trade_decide(uuid,boolean,jsonb) from public; grant execute on function public.zf_trade_decide(uuid,boolean,jsonb) to authenticated;

create or replace function public.zf_trade_cancel(p_offer uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_trade_offers;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 update public.zf_trade_offers set status='cancelled',updated_at=now() where id=p_offer and from_user_id=u and status='pending' returning * into r;
 if not found then raise exception 'Нельзя отменить это предложение.'; end if;
 return jsonb_build_object('cancelled',true);
end $$;
revoke all on function public.zf_trade_cancel(uuid) from public; grant execute on function public.zf_trade_cancel(uuid) to authenticated;

create or replace function public.zf_trade_claim_return(p_offer uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_trade_offers; card jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into r from public.zf_trade_offers where id=p_offer for update;
 if not found or r.from_user_id<>u or r.sender_claimed then raise exception 'Карточка уже получена или предложение не найдено.'; end if;
 if r.status in ('declined','cancelled') then card:=r.offered_card;
 elsif r.status='accepted' and r.counter_card is not null then card:=r.counter_card;
 else raise exception 'Пока нечего возвращать.'; end if;
 update public.zf_trade_offers set sender_claimed=true,updated_at=now() where id=p_offer;
 return jsonb_build_object('card',card);
end $$;
revoke all on function public.zf_trade_claim_return(uuid) from public; grant execute on function public.zf_trade_claim_return(uuid) to authenticated;

create or replace function public.zf_trade_inbox()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'from_user_id',t.from_user_id,'to_user_id',t.to_user_id,'from_name',p.display_name,'from_code',p.player_code,'offered_card',t.offered_card,'requested_card_hint',t.requested_card_hint,'counter_card',t.counter_card,'message',t.message,'status',t.status,'sender_claimed',t.sender_claimed,'created_at',t.created_at) order by t.created_at desc),'[]'::jsonb)
 into items from public.zf_trade_offers t join public.zf_player_profiles p on p.user_id=case when t.from_user_id=u then t.to_user_id else t.from_user_id end
 where t.from_user_id=u or t.to_user_id=u;
 return items;
end $$;
revoke all on function public.zf_trade_inbox() from public; grant execute on function public.zf_trade_inbox() to authenticated;

-- Transfer market: listing ownership and sale state are atomic; seller proceeds can be claimed once.
create or replace function public.zf_market_list(p_card jsonb,p_price numeric,p_duplicate boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings; nm text; rt integer;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_card is null or jsonb_typeof(p_card)<>'object' or p_price is null or p_price<=0 or p_price>999999999999 then raise exception 'Некорректная карточка или цена.'; end if;
 nm:=coalesce(nullif(p_card->>'name',''),'Футболист'); rt:=greatest(1,least(99,coalesce(nullif(p_card->>'rating','')::integer,1)));
 insert into public.zf_market_listings(seller_user_id,card_snapshot,card_name,card_rating,price_coins,is_duplicate)
 values(u,p_card,left(nm,80),rt,p_price,p_duplicate) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.zf_market_list(jsonb,numeric,boolean) from public; grant execute on function public.zf_market_list(jsonb,numeric,boolean) to authenticated;

create or replace function public.zf_market_search(p_search text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'seller_user_id',m.seller_user_id,'seller_name',p.display_name,'seller_code',p.player_code,'card_snapshot',m.card_snapshot,'card_name',m.card_name,'card_rating',m.card_rating,'price_coins',m.price_coins,'is_duplicate',m.is_duplicate,'created_at',m.created_at) order by m.created_at desc),'[]'::jsonb)
 into items from public.zf_market_listings m join public.zf_player_profiles p on p.user_id=m.seller_user_id
 where m.status='active' and m.seller_user_id<>u and (coalesce(trim(p_search),'')='' or m.card_name ilike '%'||trim(p_search)||'%');
 return items;
end $$;
revoke all on function public.zf_market_search(text) from public; grant execute on function public.zf_market_search(text) to authenticated;

create or replace function public.zf_market_my()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb; proceeds jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc),'[]'::jsonb) into items from public.zf_market_listings m where m.seller_user_id=u;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc),'[]'::jsonb) into proceeds from public.zf_market_proceeds p where p.seller_user_id=u and not p.claimed;
 return jsonb_build_object('listings',items,'proceeds',proceeds);
end $$;
revoke all on function public.zf_market_my() from public; grant execute on function public.zf_market_my() to authenticated;

create or replace function public.zf_market_buy(p_listing uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings; seller public.zf_player_profiles;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into r from public.zf_market_listings where id=p_listing for update;
 if not found or r.status<>'active' then raise exception 'Карточка уже продана или снята с продажи.'; end if;
 if r.seller_user_id=u then raise exception 'Нельзя купить собственную карточку.'; end if;
 update public.zf_market_listings set status='sold',buyer_user_id=u,updated_at=now() where id=p_listing returning * into r;
 insert into public.zf_market_proceeds(listing_id,seller_user_id,amount) values(r.id,r.seller_user_id,r.price_coins);
 select * into seller from public.zf_player_profiles where user_id=r.seller_user_id;
 return jsonb_build_object('listing',to_jsonb(r),'card',r.card_snapshot,'seller_name',seller.display_name,'price',r.price_coins);
end $$;
revoke all on function public.zf_market_buy(uuid) from public; grant execute on function public.zf_market_buy(uuid) to authenticated;

create or replace function public.zf_market_withdraw(p_listing uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 update public.zf_market_listings set status='withdrawn',updated_at=now() where id=p_listing and seller_user_id=u and status='active' returning * into r;
 if not found then raise exception 'Нельзя снять эту карточку с продажи.'; end if;
 return jsonb_build_object('card',r.card_snapshot,'is_duplicate',r.is_duplicate);
end $$;
revoke all on function public.zf_market_withdraw(uuid) from public; grant execute on function public.zf_market_withdraw(uuid) to authenticated;

create or replace function public.zf_market_claim_proceeds()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); total numeric;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 with claimed_rows as (update public.zf_market_proceeds set claimed=true where seller_user_id=u and not claimed returning amount)
 select coalesce(sum(amount),0) into total from claimed_rows;
 return jsonb_build_object('amount',total);
end $$;
revoke all on function public.zf_market_claim_proceeds() from public; grant execute on function public.zf_market_claim_proceeds() to authenticated;

-- Clans: single-clan membership, applications, moderation, levels and shared missions.
create or replace function public.zf_clan_create(p_name text,p_tag text,p_description text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.zf_clans;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if exists(select 1 from public.zf_clan_members where user_id=u) then raise exception 'Ты уже состоишь в клане.'; end if;
 if length(trim(coalesce(p_name,'')))<3 or length(trim(coalesce(p_name,'')))>24 then raise exception 'Название клана: от 3 до 24 символов.'; end if;
 if upper(trim(coalesce(p_tag,''))) !~ '^[A-Z0-9]{2,5}$' then raise exception 'Тег клана должен содержать 2–5 латинских букв или цифр.'; end if;
 insert into public.zf_clans(owner_user_id,name,tag,description) values(u,trim(p_name),upper(trim(p_tag)),left(coalesce(p_description,''),180)) returning * into c;
 insert into public.zf_clan_members(clan_id,user_id,role) values(c.id,u,'owner');
 insert into public.zf_clan_missions(clan_id,title,description,target,reward_xp) values
 (c.id,'Командная активность','Сыграйте 10 матчей участниками клана',10,150),
 (c.id,'Коллективный результат','Заработайте 20 побед на всех',20,250),
 (c.id,'Укрепление состава','Пригласите 3 новых участника',3,200);
 return jsonb_build_object('clan',to_jsonb(c));
end $$;
revoke all on function public.zf_clan_create(text,text,text) from public; grant execute on function public.zf_clan_create(text,text,text) to authenticated;

create or replace function public.zf_clan_search(p_query text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'tag',c.tag,'description',c.description,'level',c.level,'members',(select count(*) from public.zf_clan_members m where m.clan_id=c.id),'owner_name',p.display_name) order by c.level desc,c.created_at desc),'[]'::jsonb)
 into items from public.zf_clans c join public.zf_player_profiles p on p.user_id=c.owner_user_id
 where (coalesce(trim(p_query),'')='' or c.name ilike '%'||trim(p_query)||'%' or c.tag ilike '%'||trim(p_query)||'%') and not exists(select 1 from public.zf_clan_members where user_id=u);
 return items;
end $$;
revoke all on function public.zf_clan_search(text) from public; grant execute on function public.zf_clan_search(text) to authenticated;

create or replace function public.zf_clan_apply(p_clan uuid,p_message text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_clan_applications;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if exists(select 1 from public.zf_clan_members where user_id=u) then raise exception 'Сначала выйди из текущего клана.'; end if;
 insert into public.zf_clan_applications(clan_id,user_id,message) values(p_clan,u,left(coalesce(p_message,''),180)) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.zf_clan_apply(uuid,text) from public; grant execute on function public.zf_clan_apply(uuid,text) to authenticated;

create or replace function public.zf_clan_my()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.zf_clans; payload jsonb; applications jsonb; missions jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select cl.* into c from public.zf_clan_members m join public.zf_clans cl on cl.id=m.clan_id where m.user_id=u;
 if not found then
   select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'clan_id',a.clan_id,'clan_name',cl.name,'clan_tag',cl.tag,'user_id',a.user_id,'message',a.message,'status',a.status,'created_at',a.created_at) order by a.created_at desc),'[]'::jsonb)
   into applications from public.zf_clan_applications a join public.zf_clans cl on cl.id=a.clan_id where a.user_id=u;
   return jsonb_build_object('clan',null,'applications',applications);
 end if;
 select jsonb_build_object('id',c.id,'name',c.name,'tag',c.tag,'description',c.description,'level',c.level,'xp',c.xp,'owner_user_id',c.owner_user_id,
   'members',(select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'display_name',p.display_name,'player_code',p.player_code,'joined_at',m.joined_at) order by case m.role when 'owner' then 0 when 'officer' then 1 else 2 end,m.joined_at),'[]'::jsonb) from public.zf_clan_members m join public.zf_player_profiles p on p.user_id=m.user_id where m.clan_id=c.id),
   'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'user_id',a.user_id,'display_name',p.display_name,'player_code',p.player_code,'message',a.message,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.zf_clan_applications a join public.zf_player_profiles p on p.user_id=a.user_id where a.clan_id=c.id and a.status='pending'),
   'missions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.zf_clan_missions x where x.clan_id=c.id)
 ) into payload;
 return jsonb_build_object('clan',payload,'applications','[]'::jsonb);
end $$;
revoke all on function public.zf_clan_my() from public; grant execute on function public.zf_clan_my() to authenticated;

create or replace function public.zf_clan_review_application(p_application uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a public.zf_clan_applications; myclan uuid;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select clan_id into myclan from public.zf_clan_members where user_id=u and role in ('owner','officer');
 if myclan is null then raise exception 'Недостаточно прав.'; end if;
 select * into a from public.zf_clan_applications where id=p_application and clan_id=myclan and status='pending' for update;
 if not found then raise exception 'Заявка не найдена.'; end if;
 if p_accept then
   if exists(select 1 from public.zf_clan_members where user_id=a.user_id) then raise exception 'Игрок уже состоит в другом клане.'; end if;
   insert into public.zf_clan_members(clan_id,user_id,role) values(myclan,a.user_id,'member');
   update public.zf_clans set xp=xp+50 where id=myclan;
   update public.zf_clan_missions set progress=least(target,progress+1),completed=(least(target,progress+1)>=target) where clan_id=myclan and title='Укрепление состава';
   update public.zf_clan_applications set status='accepted' where id=p_application;
 else update public.zf_clan_applications set status='rejected' where id=p_application; end if;
 return jsonb_build_object('accepted',p_accept);
end $$;
revoke all on function public.zf_clan_review_application(uuid,boolean) from public; grant execute on function public.zf_clan_review_application(uuid,boolean) to authenticated;

create or replace function public.zf_clan_kick(p_user uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c uuid; target_role text;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select clan_id into c from public.zf_clan_members where user_id=u and role in ('owner','officer');
 if c is null then raise exception 'Недостаточно прав.'; end if;
 select role into target_role from public.zf_clan_members where clan_id=c and user_id=p_user;
 if target_role is null or target_role='owner' or (target_role='officer' and not exists(select 1 from public.zf_clan_members where clan_id=c and user_id=u and role='owner')) then raise exception 'Нельзя исключить этого участника.'; end if;
 delete from public.zf_clan_members where clan_id=c and user_id=p_user;
 return jsonb_build_object('removed',true);
end $$;
revoke all on function public.zf_clan_kick(uuid) from public; grant execute on function public.zf_clan_kick(uuid) to authenticated;

create or replace function public.zf_clan_leave()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c uuid; r text;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select clan_id,role into c,r from public.zf_clan_members where user_id=u;
 if c is null then raise exception 'Ты не состоишь в клане.'; end if;
 if r='owner' then raise exception 'Владелец должен передать права или распустить клан.'; end if;
 delete from public.zf_clan_members where user_id=u;
 return jsonb_build_object('left',true);
end $$;
revoke all on function public.zf_clan_leave() from public; grant execute on function public.zf_clan_leave() to authenticated;

-- Competitions: open registration, lock roster, invite before lock, then immutable participants/bracket.
create or replace function public.zf_competition_create(p_title text,p_kind text,p_max integer,p_draw text,p_reward jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.zf_competitions;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_kind not in ('league','tournament') or p_draw not in ('random','manual') then raise exception 'Некорректный формат соревнования.'; end if;
 if p_max<2 or p_max>64 then raise exception 'Количество участников должно быть от 2 до 64.'; end if;
 insert into public.zf_competitions(owner_user_id,title,kind,max_players,draw_mode,reward)
 values(u,left(trim(p_title),40),p_kind,p_max,p_draw,coalesce(p_reward,'{"type":"none"}'::jsonb)) returning * into c;
 insert into public.zf_competition_members(competition_id,user_id,seed) values(c.id,u,1);
 return to_jsonb(c);
end $$;
revoke all on function public.zf_competition_create(text,text,integer,text,jsonb) from public; grant execute on function public.zf_competition_create(text,text,integer,text,jsonb) to authenticated;

create or replace function public.zf_competition_list(p_kind text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'kind',c.kind,'max_players',c.max_players,'draw_mode',c.draw_mode,'reward',c.reward,'status',c.status,'owner_user_id',c.owner_user_id,'owner_name',p.display_name,'member_count',(select count(*) from public.zf_competition_members m where m.competition_id=c.id),'is_member',exists(select 1 from public.zf_competition_members m where m.competition_id=c.id and m.user_id=u),'created_at',c.created_at) order by c.created_at desc),'[]'::jsonb)
 into items from public.zf_competitions c join public.zf_player_profiles p on p.user_id=c.owner_user_id
 where (p_kind is null or c.kind=p_kind) and c.status<>'cancelled';
 return items;
end $$;
revoke all on function public.zf_competition_list(text) from public; grant execute on function public.zf_competition_list(text) to authenticated;

create or replace function public.zf_competition_join(p_competition uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.zf_competitions; n integer;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into c from public.zf_competitions where id=p_competition for update;
 if not found or c.status<>'open' then raise exception 'Регистрация уже закрыта.'; end if;
 select count(*) into n from public.zf_competition_members where competition_id=p_competition;
 if n>=c.max_players then raise exception 'Все места заняты.'; end if;
 insert into public.zf_competition_members(competition_id,user_id) values(p_competition,u) on conflict do nothing;
 return jsonb_build_object('joined',true);
end $$;
revoke all on function public.zf_competition_join(uuid) from public; grant execute on function public.zf_competition_join(uuid) to authenticated;

create or replace function public.zf_competition_invite(p_competition uuid,p_player_code text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.zf_competitions; target uuid;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into c from public.zf_competitions where id=p_competition for update;
 if not found or c.owner_user_id<>u then raise exception 'Приглашать может только создатель.'; end if;
 if c.status<>'open' then raise exception 'После подтверждения состава приглашать уже нельзя.'; end if;
 select user_id into target from public.zf_player_profiles where player_code=upper(trim(p_player_code));
 if target is null or target=u then raise exception 'Игрок не найден.'; end if;
 insert into public.zf_competition_invites(competition_id,invited_user_id,invited_by) values(p_competition,target,u) on conflict(competition_id,invited_user_id) do update set status='pending',created_at=now();
 return jsonb_build_object('invited',true);
end $$;
revoke all on function public.zf_competition_invite(uuid,text) from public; grant execute on function public.zf_competition_invite(uuid,text) to authenticated;

create or replace function public.zf_competition_invite_reply(p_invite uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); i public.zf_competition_invites; c public.zf_competitions;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into i from public.zf_competition_invites where id=p_invite and invited_user_id=u and status='pending' for update;
 if not found then raise exception 'Приглашение не найдено.'; end if;
 select * into c from public.zf_competitions where id=i.competition_id for update;
 if p_accept then
   if c.status<>'open' then raise exception 'Регистрация уже закрыта.'; end if;
   if (select count(*) from public.zf_competition_members where competition_id=c.id)>=c.max_players then raise exception 'Все места заняты.'; end if;
   insert into public.zf_competition_members(competition_id,user_id) values(c.id,u) on conflict do nothing;
 end if;
 update public.zf_competition_invites set status=case when p_accept then 'accepted' else 'declined' end where id=p_invite;
 return jsonb_build_object('accepted',p_accept);
end $$;
revoke all on function public.zf_competition_invite_reply(uuid,boolean) from public; grant execute on function public.zf_competition_invite_reply(uuid,boolean) to authenticated;

create or replace function public.zf_competition_lock(p_competition uuid,p_manual_order uuid[] default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.zf_competitions; ids uuid[]; n integer; i integer; j integer; match_n integer:=0;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into c from public.zf_competitions where id=p_competition for update;
 if not found or c.owner_user_id<>u then raise exception 'Только создатель может подтвердить состав.'; end if;
 if c.status<>'open' then raise exception 'Соревнование уже подтверждено.'; end if;
 select array_agg(user_id order by joined_at) into ids from public.zf_competition_members where competition_id=p_competition;
 n:=coalesce(array_length(ids,1),0); if n<2 then raise exception 'Нужно минимум два участника.'; end if;
 if c.draw_mode='manual' and p_manual_order is not null then
   if coalesce(array_length(p_manual_order,1),0)<>n or (select count(distinct x) from unnest(p_manual_order) x)<>n or not (p_manual_order @> ids and ids @> p_manual_order) then raise exception 'Ручная жеребьёвка должна содержать всех участников ровно по одному разу.'; end if;
   ids:=p_manual_order;
 elsif c.draw_mode='random' then
   select array_agg(x order by random()) into ids from unnest(ids) x;
 elsif c.draw_mode='manual' and p_manual_order is null then
   raise exception 'Передай порядок участников для ручной жеребьёвки.';
 end if;
 update public.zf_competitions set status='locked',updated_at=now() where id=p_competition;
 for i in 1..n loop update public.zf_competition_members set seed=i where competition_id=p_competition and user_id=ids[i]; end loop;
 if c.kind='league' then
   for i in 1..n loop
     for j in (i+1)..n loop
       match_n:=match_n+1;
       insert into public.zf_competition_matches(competition_id,round_no,match_no,home_user_id,away_user_id) values(p_competition,match_n,match_n,ids[i],ids[j]);
     end loop;
   end loop;
 else
   i:=1;
   while i<=n loop
     match_n:=match_n+1;
     if i=n then insert into public.zf_competition_matches(competition_id,round_no,match_no,home_user_id,status) values(p_competition,1,match_n,ids[i],'bye');
     else insert into public.zf_competition_matches(competition_id,round_no,match_no,home_user_id,away_user_id) values(p_competition,1,match_n,ids[i],ids[i+1]); end if;
     i:=i+2;
   end loop;
 end if;
 return jsonb_build_object('locked',true,'participants',to_jsonb(ids),'matches_created',match_n);
end $$;
revoke all on function public.zf_competition_lock(uuid,uuid[]) from public; grant execute on function public.zf_competition_lock(uuid,uuid[]) to authenticated;

create or replace function public.zf_competition_kick(p_competition uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.zf_competitions;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into c from public.zf_competitions where id=p_competition;
 if not found or c.owner_user_id<>u then raise exception 'Только создатель может исключать участников.'; end if;
 if p_user=u then raise exception 'Нельзя исключить создателя.'; end if;
 delete from public.zf_competition_members where competition_id=p_competition and user_id=p_user;
 if not found then raise exception 'Участник не найден.'; end if;
 return jsonb_build_object('removed',true);
end $$;
revoke all on function public.zf_competition_kick(uuid,uuid) from public; grant execute on function public.zf_competition_kick(uuid,uuid) to authenticated;

create or replace function public.zf_competition_my()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); invites jsonb; memberships jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'competition_id',c.id,'title',c.title,'kind',c.kind,'invited_by',p.display_name,'created_at',i.created_at) order by i.created_at desc),'[]'::jsonb) into invites
 from public.zf_competition_invites i join public.zf_competitions c on c.id=i.competition_id join public.zf_player_profiles p on p.user_id=i.invited_by where i.invited_user_id=u and i.status='pending';
 select coalesce(jsonb_agg(jsonb_build_object('competition_id',c.id,'title',c.title,'kind',c.kind,'status',c.status,'owner_user_id',c.owner_user_id,'reward',c.reward,'members',(select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',p.display_name,'player_code',p.player_code,'seed',m.seed) order by m.seed nulls last),'[]'::jsonb) from public.zf_competition_members m join public.zf_player_profiles p on p.user_id=m.user_id where m.competition_id=c.id),'matches',(select coalesce(jsonb_agg(to_jsonb(x) order by x.round_no,x.match_no),'[]'::jsonb) from public.zf_competition_matches x where x.competition_id=c.id)) order by c.created_at desc),'[]'::jsonb) into memberships
 from public.zf_competition_members cm join public.zf_competitions c on c.id=cm.competition_id where cm.user_id=u;
 return jsonb_build_object('invites',invites,'competitions',memberships);
end $$;
revoke all on function public.zf_competition_my() from public; grant execute on function public.zf_competition_my() to authenticated;

-- Minimal SELECT policies: users can read only rows needed by screens/RPC result flows.
DO $$ BEGIN
  create policy "profiles visible to authenticated players" on public.zf_player_profiles for select to authenticated using (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "contacts visible to participants" on public.zf_contacts for select to authenticated using (auth.uid()=user_a or auth.uid()=user_b);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "trade offers visible to participants" on public.zf_trade_offers for select to authenticated using (auth.uid()=from_user_id or auth.uid()=to_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "market active listings visible to authenticated players" on public.zf_market_listings for select to authenticated using (status='active' or auth.uid()=seller_user_id or auth.uid()=buyer_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "clans visible to authenticated players" on public.zf_clans for select to authenticated using (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "clan members visible to authenticated players" on public.zf_clan_members for select to authenticated using (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "clan applications visible to applicant and clan members" on public.zf_clan_applications for select to authenticated using (auth.uid()=user_id or exists(select 1 from public.zf_clan_members m where m.clan_id=zf_clan_applications.clan_id and m.user_id=auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "clan missions visible to authenticated players" on public.zf_clan_missions for select to authenticated using (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "competitions visible to authenticated players" on public.zf_competitions for select to authenticated using (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "competition members visible to authenticated players" on public.zf_competition_members for select to authenticated using (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "competition invites visible to participants" on public.zf_competition_invites for select to authenticated using (auth.uid()=invited_user_id or auth.uid()=invited_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "competition matches visible to competition participants" on public.zf_competition_matches for select to authenticated using (exists(select 1 from public.zf_competition_members m where m.competition_id=zf_competition_matches.competition_id and m.user_id=auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

comment on table public.zf_trade_offers is 'Escrow-like card offers; cards are returned to the sender via zf_trade_claim_return when declined/cancelled or when the other side offers a counter-card.';
comment on table public.zf_market_listings is 'Card-specific transfer market. Buyers receive the stored card snapshot; seller receives one claimable proceeds record.';
comment on table public.zf_competitions is 'User-created leagues and knockout tournaments. Registration locks when the owner confirms the draw.';

-- Direct clan invitations complement the application flow.
create table if not exists public.zf_clan_invites (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.zf_clans(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(clan_id,invited_user_id)
);
alter table public.zf_clan_invites enable row level security;
grant select on public.zf_clan_invites to authenticated;
DO $$ BEGIN
  create policy "clan invitations visible to participants" on public.zf_clan_invites for select to authenticated using (auth.uid()=invited_user_id or auth.uid()=invited_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create or replace function public.zf_clan_invite(p_player_code text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c uuid; target uuid; r public.zf_clan_invites;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select clan_id into c from public.zf_clan_members where user_id=u and role in ('owner','officer');
 if c is null then raise exception 'Приглашать могут владелец и заместители.'; end if;
 select user_id into target from public.zf_player_profiles where player_code=upper(trim(p_player_code));
 if target is null or target=u then raise exception 'Игрок не найден.'; end if;
 if exists(select 1 from public.zf_clan_members where user_id=target) then raise exception 'Игрок уже состоит в клане.'; end if;
 insert into public.zf_clan_invites(clan_id,invited_user_id,invited_by) values(c,target,u)
 on conflict(clan_id,invited_user_id) do update set status='pending',invited_by=u,created_at=now() returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.zf_clan_invite(text) from public; grant execute on function public.zf_clan_invite(text) to authenticated;

create or replace function public.zf_clan_invite_reply(p_invite uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_clan_invites;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into r from public.zf_clan_invites where id=p_invite and invited_user_id=u and status='pending' for update;
 if not found then raise exception 'Приглашение не найдено.'; end if;
 if p_accept then
   if exists(select 1 from public.zf_clan_members where user_id=u) then raise exception 'Сначала выйди из текущего клана.'; end if;
   insert into public.zf_clan_members(clan_id,user_id,role) values(r.clan_id,u,'member');
   update public.zf_clans set xp=xp+50 where id=r.clan_id;
   update public.zf_clan_missions set progress=least(target,progress+1),completed=(least(target,progress+1)>=target) where clan_id=r.clan_id and title='Укрепление состава';
 end if;
 update public.zf_clan_invites set status=case when p_accept then 'accepted' else 'declined' end where id=p_invite;
 return jsonb_build_object('accepted',p_accept);
end $$;
revoke all on function public.zf_clan_invite_reply(uuid,boolean) from public; grant execute on function public.zf_clan_invite_reply(uuid,boolean) to authenticated;

create or replace function public.zf_clan_disband()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c uuid;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select clan_id into c from public.zf_clan_members where user_id=u and role='owner';
 if c is null then raise exception 'Только владелец может распустить клан.'; end if;
 delete from public.zf_clans where id=c;
 return jsonb_build_object('disbanded',true);
end $$;
revoke all on function public.zf_clan_disband() from public; grant execute on function public.zf_clan_disband() to authenticated;

-- Report a competition fixture. For knockout tournaments, winners advance automatically.
create or replace function public.zf_competition_report_result(p_match uuid,p_home_score integer,p_away_score integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 u uuid:=auth.uid(); m public.zf_competition_matches; c public.zf_competitions;
 n integer; current_round integer; next_round integer; winners uuid[]; i integer; match_n integer:=0; total_matches integer;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_home_score<0 or p_away_score<0 or p_home_score>99 or p_away_score>99 then raise exception 'Некорректный счёт.'; end if;
 select * into m from public.zf_competition_matches where id=p_match for update;
 if not found or m.status not in ('scheduled','playing') then raise exception 'Этот матч уже закрыт.'; end if;
 if u<>m.home_user_id and u<>m.away_user_id then raise exception 'Результат может отправить только участник матча.'; end if;
 select * into c from public.zf_competitions where id=m.competition_id for update;
 if c.kind='tournament' and p_home_score=p_away_score then raise exception 'В турнире на выбывание нужен победитель.'; end if;
 update public.zf_competition_matches set home_score=p_home_score,away_score=p_away_score,status='finished' where id=p_match returning * into m;
 if c.kind='league' then
   select count(*) into total_matches from public.zf_competition_matches where competition_id=c.id and status in ('scheduled','playing');
   if total_matches=0 then update public.zf_competitions set status='finished',updated_at=now() where id=c.id; end if;
   return jsonb_build_object('saved',true,'competition_finished',total_matches=0);
 end if;
 current_round:=m.round_no;
 select count(*) into total_matches from public.zf_competition_matches where competition_id=c.id and round_no=current_round and status not in ('finished','bye');
 if total_matches>0 then return jsonb_build_object('saved',true,'round_finished',false); end if;
 select array_agg(winner order by match_no) into winners from (
   select match_no,case when status='bye' then home_user_id when home_score>away_score then home_user_id else away_user_id end as winner
   from public.zf_competition_matches where competition_id=c.id and round_no=current_round
 ) q where winner is not null;
 n:=coalesce(array_length(winners,1),0);
 if n=1 then
   update public.zf_competitions set status='finished',updated_at=now() where id=c.id;
   return jsonb_build_object('saved',true,'competition_finished',true,'winner',winners[1]);
 end if;
 next_round:=current_round+1; i:=1;
 while i<=n loop
   match_n:=match_n+1;
   if i=n then insert into public.zf_competition_matches(competition_id,round_no,match_no,home_user_id,status) values(c.id,next_round,match_n,winners[i],'bye');
   else insert into public.zf_competition_matches(competition_id,round_no,match_no,home_user_id,away_user_id) values(c.id,next_round,match_n,winners[i],winners[i+1]); end if;
   i:=i+2;
 end loop;
 return jsonb_build_object('saved',true,'round_finished',true,'next_round',next_round);
end $$;
revoke all on function public.zf_competition_report_result(uuid,integer,integer) from public; grant execute on function public.zf_competition_report_result(uuid,integer,integer) to authenticated;

create or replace function public.zf_clan_inbox_invites()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'clan_id',i.clan_id,'clan_name',c.name,'clan_tag',c.tag,'invited_by',p.display_name,'created_at',i.created_at) order by i.created_at desc),'[]'::jsonb) into items
 from public.zf_clan_invites i join public.zf_clans c on c.id=i.clan_id join public.zf_player_profiles p on p.user_id=i.invited_by where i.invited_user_id=u and i.status='pending';
 return items;
end $$;
revoke all on function public.zf_clan_inbox_invites() from public; grant execute on function public.zf_clan_inbox_invites() to authenticated;

-- v66 inventory ledger: card instances are synchronized once, then transferred atomically.
-- The ordinary club save remains client-side, but community transfers use this ledger
-- so one card instance cannot be simultaneously offered and listed by two players.
create table if not exists public.zf_card_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  card_snapshot jsonb not null,
  status text not null default 'owned' check(status in ('owned','offered','listed','transferred')),
  is_starter boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,card_id)
);
create index if not exists zf_card_inventory_status_idx on public.zf_card_inventory(user_id,status);
alter table public.zf_card_inventory enable row level security;
grant select on public.zf_card_inventory to authenticated;
DO $$ BEGIN
  create policy "players can read own card inventory" on public.zf_card_inventory for select to authenticated using (auth.uid()=user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create or replace function public.zf_card_inventory_sync(p_cards jsonb,p_starters jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); card jsonb; cid text; starter boolean; n integer:=0;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if jsonb_typeof(coalesce(p_cards,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_starters,'[]'::jsonb))<>'array' then raise exception 'Некорректный список карточек.'; end if;
 if jsonb_array_length(coalesce(p_cards,'[]'::jsonb))>1000 then raise exception 'Слишком много карточек.'; end if;
 for card in select value from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) loop
   cid:=nullif(card->>'id','');
   if cid is null then continue; end if;
   starter:=coalesce(p_starters ? cid,false);
   insert into public.zf_card_inventory(user_id,card_id,card_snapshot,status,is_starter,updated_at)
   values(u,cid,card,'owned',starter,now())
   on conflict(user_id,card_id) do update set
     card_snapshot=excluded.card_snapshot,
     is_starter=excluded.is_starter,
     updated_at=now()
   where public.zf_card_inventory.status='owned';
   n:=n+1;
 end loop;
 return jsonb_build_object('synced',n);
end $$;
revoke all on function public.zf_card_inventory_sync(jsonb,jsonb) from public; grant execute on function public.zf_card_inventory_sync(jsonb,jsonb) to authenticated;

create or replace function public.zf_card_inventory_list()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('card_id',card_id,'card_snapshot',card_snapshot,'status',status,'is_starter',is_starter) order by card_snapshot->>'name'),'[]'::jsonb)
 into items from public.zf_card_inventory where user_id=u;
 return items;
end $$;
revoke all on function public.zf_card_inventory_list() from public; grant execute on function public.zf_card_inventory_list() to authenticated;

-- Disable the earlier snapshot-taking RPCs: only card IDs present in the inventory ledger are accepted.
revoke all on function public.zf_trade_create(uuid,jsonb,text,text) from public,authenticated;
revoke all on function public.zf_trade_decide(uuid,boolean,jsonb) from public,authenticated;
revoke all on function public.zf_trade_claim_return(uuid) from public,authenticated;
revoke all on function public.zf_market_list(jsonb,numeric,boolean) from public,authenticated;

alter table public.zf_trade_offers add column if not exists offered_card_id text;
alter table public.zf_trade_offers add column if not exists counter_card_id text;

create or replace function public.zf_trade_create(p_to uuid,p_card_id text,p_requested_hint text default null,p_message text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); card public.zf_card_inventory; r public.zf_trade_offers;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_to=u or nullif(trim(p_card_id),'') is null then raise exception 'Некорректное предложение.'; end if;
 if not exists(select 1 from public.zf_contacts where user_a=least(u,p_to) and user_b=greatest(u,p_to) and status in ('friend','acquaintance')) then raise exception 'Обмен доступен только знакомым и друзьям.'; end if;
 if not exists(select 1 from public.zf_player_profiles where user_id=p_to) then raise exception 'Профиль получателя не найден.'; end if;
 select * into card from public.zf_card_inventory where user_id=u and card_id=p_card_id for update;
 if not found or card.status<>'owned' then raise exception 'Карточка уже используется в другом предложении или на рынке.'; end if;
 if card.is_starter then raise exception 'Нельзя отправлять игрока из стартового состава.'; end if;
 if card.card_snapshot->>'marketResaleOnly'='true' then raise exception 'Повторную карточку можно только перепродать.'; end if;
 insert into public.zf_trade_offers(from_user_id,to_user_id,offered_card,offered_card_id,requested_card_hint,message)
 values(u,p_to,card.card_snapshot,p_card_id,left(coalesce(p_requested_hint,''),80),left(coalesce(p_message,''),180)) returning * into r;
 update public.zf_card_inventory set status='offered',updated_at=now() where user_id=u and card_id=p_card_id;
 return to_jsonb(r);
end $$;
revoke all on function public.zf_trade_create(uuid,text,text,text) from public; grant execute on function public.zf_trade_create(uuid,text,text,text) to authenticated;

create or replace function public.zf_trade_decide(p_offer uuid,p_accept boolean,p_counter_card_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_trade_offers; counter public.zf_card_inventory;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into r from public.zf_trade_offers where id=p_offer for update;
 if not found or r.to_user_id<>u then raise exception 'Предложение не найдено.'; end if;
 if r.status<>'pending' then raise exception 'Предложение уже обработано.'; end if;
 if p_accept and length(coalesce(r.requested_card_hint,''))>0 then
   select * into counter from public.zf_card_inventory where user_id=u and card_id=p_counter_card_id for update;
   if not found or counter.status<>'owned' or counter.is_starter or counter.card_snapshot->>'marketResaleOnly'='true' then raise exception 'Выбери доступную обычную карточку из резерва.'; end if;
 end if;
 if p_accept then
   if not exists(select 1 from public.zf_card_inventory where user_id=r.from_user_id and card_id=r.offered_card_id and status='offered') then raise exception 'Отправленная карточка больше недоступна.'; end if;
   delete from public.zf_card_inventory where user_id=r.from_user_id and card_id=r.offered_card_id;
   insert into public.zf_card_inventory(user_id,card_id,card_snapshot,status,is_starter) values(u,r.offered_card_id,r.offered_card,'owned',false)
   on conflict(user_id,card_id) do update set card_snapshot=excluded.card_snapshot,status='owned',is_starter=false,updated_at=now();
   if counter.card_id is not null then
     delete from public.zf_card_inventory where user_id=u and card_id=counter.card_id;
     insert into public.zf_card_inventory(user_id,card_id,card_snapshot,status,is_starter) values(r.from_user_id,counter.card_id,counter.card_snapshot,'owned',false)
     on conflict(user_id,card_id) do update set card_snapshot=excluded.card_snapshot,status='owned',is_starter=false,updated_at=now();
   end if;
   update public.zf_trade_offers set status='accepted',counter_card=case when counter.card_id is null then null else counter.card_snapshot end,counter_card_id=counter.card_id,updated_at=now() where id=p_offer returning * into r;
 else
   update public.zf_card_inventory set status='owned',updated_at=now() where user_id=r.from_user_id and card_id=r.offered_card_id and status='offered';
   update public.zf_trade_offers set status='declined',updated_at=now() where id=p_offer returning * into r;
 end if;
 return jsonb_build_object('offer',to_jsonb(r));
end $$;
revoke all on function public.zf_trade_decide(uuid,boolean,text) from public; grant execute on function public.zf_trade_decide(uuid,boolean,text) to authenticated;

create or replace function public.zf_trade_cancel(p_offer uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_trade_offers;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 update public.zf_trade_offers set status='cancelled',updated_at=now() where id=p_offer and from_user_id=u and status='pending' returning * into r;
 if not found then raise exception 'Нельзя отменить это предложение.'; end if;
 update public.zf_card_inventory set status='owned',updated_at=now() where user_id=u and card_id=r.offered_card_id and status='offered';
 return jsonb_build_object('cancelled',true,'card_id',r.offered_card_id);
end $$;
revoke all on function public.zf_trade_cancel(uuid) from public; grant execute on function public.zf_trade_cancel(uuid) to authenticated;

create or replace function public.zf_market_list(p_card_id text,p_price numeric,p_duplicate boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); card public.zf_card_inventory; r public.zf_market_listings;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_price is null or p_price<=0 or p_price>999999999999 then raise exception 'Некорректная цена.'; end if;
 select * into card from public.zf_card_inventory where user_id=u and card_id=p_card_id for update;
 if not found or card.status<>'owned' then raise exception 'Карточка уже выставлена или передана.'; end if;
 if card.is_starter then raise exception 'Футболиста из стартового состава нельзя выставить.'; end if;
 insert into public.zf_market_listings(seller_user_id,card_snapshot,card_name,card_rating,price_coins,is_duplicate)
 values(u,card.card_snapshot,left(coalesce(card.card_snapshot->>'name','Футболист'),80),greatest(1,least(99,coalesce(nullif(card.card_snapshot->>'rating','')::integer,1))),p_price,p_duplicate or (card.card_snapshot->>'marketResaleOnly'='true')) returning * into r;
 update public.zf_card_inventory set status='listed',updated_at=now() where user_id=u and card_id=p_card_id;
 return to_jsonb(r);
end $$;
revoke all on function public.zf_market_list(text,numeric,boolean) from public; grant execute on function public.zf_market_list(text,numeric,boolean) to authenticated;

create or replace function public.zf_market_buy(p_listing uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings; seller_card public.zf_card_inventory;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into r from public.zf_market_listings where id=p_listing for update;
 if not found or r.status<>'active' then raise exception 'Карточка уже продана или снята с продажи.'; end if;
 if r.seller_user_id=u then raise exception 'Нельзя купить собственную карточку.'; end if;
 update public.zf_market_listings set status='sold',buyer_user_id=u,updated_at=now() where id=p_listing returning * into r;
 delete from public.zf_card_inventory where user_id=r.seller_user_id and card_id=(r.card_snapshot->>'id') and status='listed';
 insert into public.zf_card_inventory(user_id,card_id,card_snapshot,status,is_starter)
 values(u,r.card_snapshot->>'id',r.card_snapshot,'owned',false)
 on conflict(user_id,card_id) do update set card_snapshot=excluded.card_snapshot,status='owned',is_starter=false,updated_at=now();
 insert into public.zf_market_proceeds(listing_id,seller_user_id,amount) values(r.id,r.seller_user_id,r.price_coins);
 return jsonb_build_object('listing',to_jsonb(r),'card',r.card_snapshot,'price',r.price_coins);
end $$;
revoke all on function public.zf_market_buy(uuid) from public; grant execute on function public.zf_market_buy(uuid) to authenticated;

create or replace function public.zf_market_withdraw(p_listing uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 update public.zf_market_listings set status='withdrawn',updated_at=now() where id=p_listing and seller_user_id=u and status='active' returning * into r;
 if not found then raise exception 'Нельзя снять эту карточку с продажи.'; end if;
 update public.zf_card_inventory set status='owned',updated_at=now() where user_id=u and card_id=(r.card_snapshot->>'id') and status='listed';
 return jsonb_build_object('card',r.card_snapshot,'is_duplicate',r.is_duplicate);
end $$;
revoke all on function public.zf_market_withdraw(uuid) from public; grant execute on function public.zf_market_withdraw(uuid) to authenticated;

-- Only the inventory RPC can create/update owned rows; direct table writes are not granted.
revoke insert,update,delete on public.zf_card_inventory from anon,authenticated;

-- Market purchase/withdraw must move a real inventory row, not only a marketplace snapshot.
create or replace function public.zf_market_buy(p_listing uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings; seller_card public.zf_card_inventory;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into r from public.zf_market_listings where id=p_listing for update;
 if not found or r.status<>'active' then raise exception 'Карточка уже продана или снята с продажи.'; end if;
 if r.seller_user_id=u then raise exception 'Нельзя купить собственную карточку.'; end if;
 delete from public.zf_card_inventory where user_id=r.seller_user_id and card_id=(r.card_snapshot->>'id') and status='listed' returning * into seller_card;
 if not found then raise exception 'Карточка продавца не найдена в инвентаре. Обнови рынок и попробуй снова.'; end if;
 update public.zf_market_listings set status='sold',buyer_user_id=u,updated_at=now() where id=p_listing returning * into r;
 insert into public.zf_card_inventory(user_id,card_id,card_snapshot,status,is_starter)
 values(u,seller_card.card_id,seller_card.card_snapshot,'owned',false)
 on conflict(user_id,card_id) do update set card_snapshot=excluded.card_snapshot,status='owned',is_starter=false,updated_at=now();
 insert into public.zf_market_proceeds(listing_id,seller_user_id,amount) values(r.id,r.seller_user_id,r.price_coins);
 return jsonb_build_object('listing',to_jsonb(r),'card',seller_card.card_snapshot,'price',r.price_coins);
end $$;
revoke all on function public.zf_market_buy(uuid) from public; grant execute on function public.zf_market_buy(uuid) to authenticated;

create or replace function public.zf_market_withdraw(p_listing uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings; card public.zf_card_inventory;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into r from public.zf_market_listings where id=p_listing and seller_user_id=u and status='active' for update;
 if not found then raise exception 'Нельзя снять эту карточку с продажи.'; end if;
 update public.zf_card_inventory set status='owned',updated_at=now() where user_id=u and card_id=(r.card_snapshot->>'id') and status='listed' returning * into card;
 if not found then raise exception 'Карточка не найдена в инвентаре. Обнови рынок.'; end if;
 update public.zf_market_listings set status='withdrawn',updated_at=now() where id=p_listing;
 return jsonb_build_object('card',card.card_snapshot,'is_duplicate',r.is_duplicate);
end $$;
revoke all on function public.zf_market_withdraw(uuid) from public; grant execute on function public.zf_market_withdraw(uuid) to authenticated;

-- Competition results require both players: first one reports, the opponent confirms the same score.
alter table public.zf_competition_matches add column if not exists reported_by uuid references auth.users(id) on delete set null;
alter table public.zf_competition_matches add column if not exists confirmed_by uuid references auth.users(id) on delete set null;
alter table public.zf_competition_matches drop constraint if exists zf_competition_matches_status_check;
alter table public.zf_competition_matches add constraint zf_competition_matches_status_check check(status in ('scheduled','playing','reported','finished','bye'));

create or replace function public.zf_competition_report_result(p_match uuid,p_home_score integer,p_away_score integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 u uuid:=auth.uid(); m public.zf_competition_matches; c public.zf_competitions;
 total_matches integer; current_round integer; next_round integer; winners uuid[]; n integer; i integer; match_n integer:=0;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if p_home_score<0 or p_away_score<0 or p_home_score>99 or p_away_score>99 then raise exception 'Некорректный счёт.'; end if;
 select * into m from public.zf_competition_matches where id=p_match for update;
 if not found then raise exception 'Матч соревнования не найден.'; end if;
 if u<>m.home_user_id and u<>m.away_user_id then raise exception 'Результат может отправить только участник матча.'; end if;
 if not exists(select 1 from public.zf_competition_members where competition_id=m.competition_id and user_id=u) then raise exception 'Ты уже исключён из этого соревнования.'; end if;
 if m.status in ('scheduled','playing') then
   update public.zf_competition_matches set home_score=p_home_score,away_score=p_away_score,status='reported',reported_by=u where id=p_match;
   return jsonb_build_object('saved',true,'pending_confirmation',true);
 end if;
 if m.status<>'reported' then raise exception 'Этот матч уже закрыт или ожидает другого действия.'; end if;
 if m.reported_by=u then raise exception 'Счёт должен подтвердить второй участник матча.'; end if;
 if m.home_score<>p_home_score or m.away_score<>p_away_score then raise exception 'Счёт не совпадает с отправленным соперником. Свяжитесь и согласуйте результат.'; end if;
 select * into c from public.zf_competitions where id=m.competition_id for update;
 if c.kind='tournament' and p_home_score=p_away_score then raise exception 'В турнире на выбывание нужен победитель.'; end if;
 update public.zf_competition_matches set status='finished',confirmed_by=u where id=p_match returning * into m;
 if c.kind='league' then
   select count(*) into total_matches from public.zf_competition_matches where competition_id=c.id and status in ('scheduled','playing','reported');
   if total_matches=0 then update public.zf_competitions set status='finished',updated_at=now() where id=c.id; end if;
   return jsonb_build_object('saved',true,'competition_finished',total_matches=0);
 end if;
 current_round:=m.round_no;
 select count(*) into total_matches from public.zf_competition_matches where competition_id=c.id and round_no=current_round and status not in ('finished','bye');
 if total_matches>0 then return jsonb_build_object('saved',true,'round_finished',false); end if;
 select array_agg(winner order by match_no) into winners from (
   select match_no,case when status='bye' then home_user_id when home_score>away_score then home_user_id else away_user_id end as winner
   from public.zf_competition_matches where competition_id=c.id and round_no=current_round
 ) q where winner is not null;
 n:=coalesce(array_length(winners,1),0);
 if n=1 then
   update public.zf_competitions set status='finished',updated_at=now() where id=c.id;
   return jsonb_build_object('saved',true,'competition_finished',true,'winner',winners[1]);
 end if;
 next_round:=current_round+1; i:=1;
 while i<=n loop
   match_n:=match_n+1;
   if i=n then insert into public.zf_competition_matches(competition_id,round_no,match_no,home_user_id,status) values(c.id,next_round,match_n,winners[i],'bye');
   else insert into public.zf_competition_matches(competition_id,round_no,match_no,home_user_id,away_user_id) values(c.id,next_round,match_n,winners[i],winners[i+1]); end if;
   i:=i+2;
 end loop;
 return jsonb_build_object('saved',true,'round_finished',true,'next_round',next_round);
end $$;
revoke all on function public.zf_competition_report_result(uuid,integer,integer) from public; grant execute on function public.zf_competition_report_result(uuid,integer,integer) to authenticated;

-- Clan activity contributes XP and advances the shared missions; level is derived from XP.
create or replace function public.zf_clan_set_level_from_xp()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 new.level:=least(100,1+floor(greatest(0,new.xp)::numeric/500)::integer);
 return new;
end $$;
DO $$ BEGIN
  create trigger zf_clan_level_from_xp before update of xp on public.zf_clans for each row execute function public.zf_clan_set_level_from_xp();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create or replace function public.zf_clan_record_match(p_win boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c uuid; gained integer; new_xp integer; new_level integer;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select clan_id into c from public.zf_clan_members where user_id=u;
 if c is null then return jsonb_build_object('recorded',false,'reason','no_clan'); end if;
 gained:=case when coalesce(p_win,false) then 15 else 10 end;
 update public.zf_clans set xp=xp+gained where id=c returning xp,level into new_xp,new_level;
 update public.zf_clan_missions set progress=least(target,progress+1),completed=(least(target,progress+1)>=target) where clan_id=c and title='Командная активность';
 if coalesce(p_win,false) then
   update public.zf_clan_missions set progress=least(target,progress+1),completed=(least(target,progress+1)>=target) where clan_id=c and title='Коллективный результат';
 end if;
 return jsonb_build_object('recorded',true,'xp_gained',gained,'xp',new_xp,'level',new_level);
end $$;
revoke all on function public.zf_clan_record_match(boolean) from public; grant execute on function public.zf_clan_record_match(boolean) to authenticated;

-- Rejected applications may be submitted again later.
create or replace function public.zf_clan_apply(p_clan uuid,p_message text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_clan_applications;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 if exists(select 1 from public.zf_clan_members where user_id=u) then raise exception 'Сначала выйди из текущего клана.'; end if;
 insert into public.zf_clan_applications(clan_id,user_id,message,status)
 values(p_clan,u,left(coalesce(p_message,''),180),'pending')
 on conflict(clan_id,user_id) do update set message=excluded.message,status='pending',created_at=now()
 where public.zf_clan_applications.status<>'pending'
 returning * into r;
 if not found then raise exception 'Заявка уже ожидает рассмотрения.'; end if;
 return to_jsonb(r);
end $$;
revoke all on function public.zf_clan_apply(uuid,text) from public; grant execute on function public.zf_clan_apply(uuid,text) to authenticated;

-- Kicking from a locked competition resolves the affected fixture as a forfeit/bye.
create or replace function public.zf_competition_kick(p_competition uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.zf_competitions;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select * into c from public.zf_competitions where id=p_competition for update;
 if not found or c.owner_user_id<>u then raise exception 'Только создатель может исключать участников.'; end if;
 if p_user=u then raise exception 'Нельзя исключить создателя.'; end if;
 if c.kind='league' and c.status='locked' then
   update public.zf_competition_matches set
     home_score=case when home_user_id=p_user then 0 else 3 end,
     away_score=case when away_user_id=p_user then 0 else 3 end,
     status='finished',reported_by=null,confirmed_by=u
   where competition_id=p_competition and status in ('scheduled','playing','reported') and (home_user_id=p_user or away_user_id=p_user);
 elsif c.kind='tournament' and c.status='locked' then
   update public.zf_competition_matches set
     home_user_id=case when home_user_id=p_user then away_user_id else home_user_id end,
     away_user_id=null,home_score=null,away_score=null,status='bye',reported_by=null,confirmed_by=null
   where competition_id=p_competition and status in ('scheduled','playing','reported') and (home_user_id=p_user or away_user_id=p_user);
 end if;
 delete from public.zf_competition_members where competition_id=p_competition and user_id=p_user;
 if not found then raise exception 'Участник не найден.'; end if;
 return jsonb_build_object('removed',true,'forfeit_recorded',c.status='locked');
end $$;
revoke all on function public.zf_competition_kick(uuid,uuid) from public; grant execute on function public.zf_competition_kick(uuid,uuid) to authenticated;

-- Removed participants cannot submit or confirm a fixture after being kicked.
-- The check is part of the same result RPC and uses the authenticated member identity.


-- Global card identity: the same card instance can belong to only one account.
-- This also prevents an old browser save from re-creating a card after transfer.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.zf_card_inventory GROUP BY card_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'В инвентаре уже есть карточки с одинаковыми ID. Обратитесь к администратору до включения трансферов.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS zf_card_inventory_global_card_id_uidx
  ON public.zf_card_inventory(card_id);

-- Inventory sync imports only IDs not already owned by another account.
-- Rows in offered/listed escrow cannot be overwritten by stale local saves.
CREATE OR REPLACE FUNCTION public.zf_card_inventory_sync(p_cards jsonb,p_starters jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid(); card jsonb; cid text; starter boolean; n integer:=0;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Необходимо войти в аккаунт.'; END IF;
  IF jsonb_typeof(coalesce(p_cards,'[]'::jsonb))<>'array' OR jsonb_typeof(coalesce(p_starters,'[]'::jsonb))<>'array' THEN
    RAISE EXCEPTION 'Некорректный список карточек.';
  END IF;
  IF jsonb_array_length(coalesce(p_cards,'[]'::jsonb))>1000 THEN RAISE EXCEPTION 'Слишком много карточек.'; END IF;
  FOR card IN SELECT value FROM jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) LOOP
    cid:=nullif(card->>'id','');
    IF cid IS NULL OR length(cid)>160 OR jsonb_typeof(card)<>'object' THEN CONTINUE; END IF;
    starter:=coalesce(p_starters ? cid,false);
    INSERT INTO public.zf_card_inventory(user_id,card_id,card_snapshot,status,is_starter,updated_at)
    SELECT u,cid,card,'owned',starter,now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.zf_card_inventory occupied
      WHERE occupied.card_id=cid AND occupied.user_id<>u
    )
    ON CONFLICT(user_id,card_id) DO UPDATE SET
      card_snapshot=excluded.card_snapshot,
      is_starter=excluded.is_starter,
      updated_at=now()
    WHERE public.zf_card_inventory.status='owned';
    n:=n+1;
  END LOOP;
  RETURN jsonb_build_object('synced',n);
END $$;
REVOKE ALL ON FUNCTION public.zf_card_inventory_sync(jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zf_card_inventory_sync(jsonb,jsonb) TO authenticated;


-- Award clan mission XP once, on the first transition to completed.
CREATE OR REPLACE FUNCTION public.zf_clan_award_mission_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.completed IS TRUE AND OLD.completed IS FALSE THEN
    UPDATE public.zf_clans SET xp=xp+NEW.reward_xp WHERE id=NEW.clan_id;
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  CREATE TRIGGER zf_clan_mission_award_xp
  AFTER UPDATE OF completed ON public.zf_clan_missions
  FOR EACH ROW EXECUTE FUNCTION public.zf_clan_award_mission_xp();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE ALL ON FUNCTION public.zf_clan_award_mission_xp() FROM PUBLIC;
