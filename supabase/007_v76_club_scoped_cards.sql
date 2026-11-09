-- Zero Football v76: player-card inventory, transfers and proceeds belong to the active club.
-- Run after migrations 001-006. Legacy account-wide rows are assigned to the first club
-- that opens the social/market section after this migration; no cards are deleted.

begin;

alter table public.zf_card_inventory
  add column if not exists club_id text not null default 'legacy';
alter table public.zf_market_listings
  add column if not exists seller_club_id text not null default 'legacy';
alter table public.zf_market_proceeds
  add column if not exists club_id text not null default 'legacy';
alter table public.zf_trade_offers
  add column if not exists from_club_id text not null default 'legacy';

-- Replace account-wide card identity with a club-scoped key.
drop index if exists public.zf_card_inventory_global_card_id_uidx;
alter table public.zf_card_inventory drop constraint if exists zf_card_inventory_pkey;
alter table public.zf_card_inventory add constraint zf_card_inventory_pkey primary key(user_id,club_id,card_id);
create index if not exists zf_card_inventory_club_status_idx
  on public.zf_card_inventory(user_id,club_id,status);
create index if not exists zf_market_listings_seller_club_idx
  on public.zf_market_listings(seller_user_id,seller_club_id,status,created_at desc);
create index if not exists zf_market_proceeds_seller_club_idx
  on public.zf_market_proceeds(seller_user_id,club_id,claimed,created_at desc);

-- Remove old RPC signatures so PostgREST cannot choose an ambiguous overload.
drop function if exists public.zf_card_inventory_sync(jsonb,jsonb);
drop function if exists public.zf_card_inventory_list();
drop function if exists public.zf_trade_create(uuid,text,text,text);
drop function if exists public.zf_trade_decide(uuid,boolean,text);
drop function if exists public.zf_market_list(text,numeric,boolean);
drop function if exists public.zf_market_buy(uuid);
drop function if exists public.zf_market_withdraw(uuid);
drop function if exists public.zf_market_my();
drop function if exists public.zf_market_claim_proceeds();

create or replace function public.zf_card_inventory_sync(
  p_cards jsonb,
  p_starters jsonb default '[]'::jsonb,
  p_club_id text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  u uuid:=auth.uid(); card jsonb; cid text; starter boolean; n integer:=0; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 then raise exception 'Не указан активный клуб.'; end if;
  if jsonb_typeof(coalesce(p_cards,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_starters,'[]'::jsonb))<>'array' then
    raise exception 'Некорректный список карточек.';
  end if;
  if jsonb_array_length(coalesce(p_cards,'[]'::jsonb))>1000 then raise exception 'Слишком много карточек.'; end if;

  -- One-time compatibility bridge for the old account-wide ledger.
  update public.zf_card_inventory set club_id=club_key,updated_at=now()
    where user_id=u and club_id='legacy';
  update public.zf_market_listings set seller_club_id=club_key,updated_at=now()
    where seller_user_id=u and seller_club_id='legacy';
  update public.zf_market_proceeds set club_id=club_key
    where seller_user_id=u and club_id='legacy';
  update public.zf_trade_offers set from_club_id=club_key,updated_at=now()
    where from_user_id=u and from_club_id='legacy';

  -- Treat the submitted club roster as the source of truth. Remove stale owned rows
  -- that are no longer present locally (for example, cards sold from the collection).
  -- Keep listed/offered rows: those are intentionally outside the owned roster.
  delete from public.zf_card_inventory as inventory
    where inventory.user_id=u and inventory.club_id=club_key and inventory.status='owned'
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) as incoming(card)
        where nullif(incoming.card->>'id','')=inventory.card_id
      );

  for card in select value from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) loop
    cid:=nullif(card->>'id','');
    if cid is null or length(cid)>160 or jsonb_typeof(card)<>'object' then continue; end if;
    starter:=coalesce(p_starters ? cid,false);
    insert into public.zf_card_inventory(user_id,club_id,card_id,card_snapshot,status,is_starter,updated_at)
    values(u,club_key,cid,card,'owned',starter,now())
    on conflict(user_id,club_id,card_id) do update set
      card_snapshot=excluded.card_snapshot,
      is_starter=excluded.is_starter,
      updated_at=now()
    where public.zf_card_inventory.status='owned';
    n:=n+1;
  end loop;
  return jsonb_build_object('synced',n,'club_id',club_key);
end $$;
revoke all on function public.zf_card_inventory_sync(jsonb,jsonb,text) from public;
grant execute on function public.zf_card_inventory_sync(jsonb,jsonb,text) to authenticated;

create or replace function public.zf_card_inventory_list(p_club_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 then raise exception 'Не указан активный клуб.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'card_id',card_id,'card_snapshot',card_snapshot,'status',status,'is_starter',is_starter
  ) order by card_snapshot->>'name'),'[]'::jsonb)
  into items from public.zf_card_inventory
  where user_id=u and club_id=club_key;
  return items;
end $$;
revoke all on function public.zf_card_inventory_list(text) from public;
grant execute on function public.zf_card_inventory_list(text) to authenticated;

create or replace function public.zf_trade_create(
  p_to uuid,
  p_card_id text,
  p_club_id text,
  p_requested_hint text default null,
  p_message text default ''
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); card public.zf_card_inventory; r public.zf_trade_offers; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 or p_to=u or nullif(trim(p_card_id),'') is null then raise exception 'Некорректное предложение.'; end if;
  if not exists(select 1 from public.zf_contacts where user_a=least(u,p_to) and user_b=greatest(u,p_to) and status in ('friend','acquaintance')) then raise exception 'Обмен доступен только знакомым и друзьям.'; end if;
  if not exists(select 1 from public.zf_player_profiles where user_id=p_to) then raise exception 'Профиль получателя не найден.'; end if;
  select * into card from public.zf_card_inventory
    where user_id=u and club_id=club_key and card_id=p_card_id for update;
  if not found or card.status<>'owned' then raise exception 'Карточка уже используется в другом предложении или на рынке.'; end if;
  if card.is_starter then raise exception 'Нельзя отправлять игрока из стартового состава.'; end if;
  if card.card_snapshot->>'marketResaleOnly'='true' then raise exception 'Повторную карточку можно только перепродать.'; end if;
  insert into public.zf_trade_offers(from_user_id,to_user_id,offered_card,offered_card_id,from_club_id,requested_card_hint,message)
  values(u,p_to,card.card_snapshot,p_card_id,club_key,left(coalesce(p_requested_hint,''),80),left(coalesce(p_message,''),180)) returning * into r;
  update public.zf_card_inventory set status='offered',updated_at=now()
    where user_id=u and club_id=club_key and card_id=p_card_id;
  return to_jsonb(r);
end $$;
revoke all on function public.zf_trade_create(uuid,text,text,text,text) from public;
grant execute on function public.zf_trade_create(uuid,text,text,text,text) to authenticated;

create or replace function public.zf_trade_decide(
  p_offer uuid,
  p_accept boolean,
  p_club_id text,
  p_counter_card_id text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_trade_offers; counter public.zf_card_inventory; sender_card public.zf_card_inventory; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 then raise exception 'Не указан активный клуб.'; end if;
  select * into r from public.zf_trade_offers where id=p_offer for update;
  if not found or r.to_user_id<>u then raise exception 'Предложение не найдено.'; end if;
  if r.status<>'pending' then raise exception 'Предложение уже обработано.'; end if;
  if p_accept and length(coalesce(r.requested_card_hint,''))>0 then
    select * into counter from public.zf_card_inventory
      where user_id=u and club_id=club_key and card_id=p_counter_card_id for update;
    if not found or counter.status<>'owned' or counter.is_starter or counter.card_snapshot->>'marketResaleOnly'='true' then
      raise exception 'Выбери доступную обычную карточку из резерва текущего клуба.';
    end if;
  end if;
  if p_accept then
    delete from public.zf_card_inventory
      where user_id=r.from_user_id and club_id=r.from_club_id and card_id=r.offered_card_id and status='offered'
      returning * into sender_card;
    if not found then raise exception 'Отправленная карточка больше недоступна.'; end if;
    insert into public.zf_card_inventory(user_id,club_id,card_id,card_snapshot,status,is_starter)
      values(u,club_key,r.offered_card_id,r.offered_card,'owned',false)
      on conflict(user_id,club_id,card_id) do update set card_snapshot=excluded.card_snapshot,status='owned',is_starter=false,updated_at=now();
    if counter.card_id is not null then
      delete from public.zf_card_inventory where user_id=u and club_id=club_key and card_id=counter.card_id;
      insert into public.zf_card_inventory(user_id,club_id,card_id,card_snapshot,status,is_starter)
        values(r.from_user_id,r.from_club_id,counter.card_id,counter.card_snapshot,'owned',false)
        on conflict(user_id,club_id,card_id) do update set card_snapshot=excluded.card_snapshot,status='owned',is_starter=false,updated_at=now();
    end if;
    update public.zf_trade_offers set status='accepted',counter_card=case when counter.card_id is null then null else counter.card_snapshot end,
      counter_card_id=counter.card_id,updated_at=now() where id=p_offer returning * into r;
  else
    update public.zf_card_inventory set status='owned',updated_at=now()
      where user_id=r.from_user_id and club_id=r.from_club_id and card_id=r.offered_card_id and status='offered';
    update public.zf_trade_offers set status='declined',updated_at=now() where id=p_offer returning * into r;
  end if;
  return jsonb_build_object('offer',to_jsonb(r));
end $$;
revoke all on function public.zf_trade_decide(uuid,boolean,text,text) from public;
grant execute on function public.zf_trade_decide(uuid,boolean,text,text) to authenticated;

create or replace function public.zf_trade_cancel(p_offer uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_trade_offers; card public.zf_card_inventory;
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  update public.zf_trade_offers set status='cancelled',updated_at=now()
    where id=p_offer and from_user_id=u and status='pending' returning * into r;
  if not found then raise exception 'Нельзя отменить это предложение.'; end if;
  update public.zf_card_inventory set status='owned',updated_at=now()
    where user_id=u and club_id=r.from_club_id and card_id=r.offered_card_id and status='offered'
    returning * into card;
  return jsonb_build_object('cancelled',true,'card_id',r.offered_card_id,'club_id',r.from_club_id,'card',card.card_snapshot);
end $$;
revoke all on function public.zf_trade_cancel(uuid) from public;
grant execute on function public.zf_trade_cancel(uuid) to authenticated;

create or replace function public.zf_market_list(
  p_card_id text,
  p_price numeric,
  p_club_id text,
  p_duplicate boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); card public.zf_card_inventory; r public.zf_market_listings; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 or p_price is null or p_price<=0 or p_price>999999999999 then raise exception 'Некорректная цена или клуб.'; end if;
  select * into card from public.zf_card_inventory
    where user_id=u and club_id=club_key and card_id=p_card_id for update;
  if not found or card.status<>'owned' then raise exception 'Карточка уже выставлена или передана.'; end if;
  if card.is_starter then raise exception 'Футболиста из стартового состава нельзя выставить.'; end if;
  insert into public.zf_market_listings(seller_user_id,seller_club_id,card_snapshot,card_name,card_rating,price_coins,is_duplicate)
  values(u,club_key,card.card_snapshot,left(coalesce(card.card_snapshot->>'name','Футболист'),80),
    greatest(1,least(99,coalesce(nullif(card.card_snapshot->>'rating','')::integer,1))),p_price,
    coalesce(p_duplicate,false) or coalesce(card.card_snapshot->>'marketResaleOnly'='true',false)) returning * into r;
  update public.zf_card_inventory set status='listed',updated_at=now()
    where user_id=u and club_id=club_key and card_id=p_card_id;
  return to_jsonb(r);
end $$;
revoke all on function public.zf_market_list(text,numeric,text,boolean) from public;
grant execute on function public.zf_market_list(text,numeric,text,boolean) to authenticated;

create or replace function public.zf_market_buy(p_listing uuid,p_club_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings; seller_card public.zf_card_inventory; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 then raise exception 'Не указан активный клуб.'; end if;
  select * into r from public.zf_market_listings where id=p_listing for update;
  if not found or r.status<>'active' then raise exception 'Карточка уже продана или снята с продажи.'; end if;
  if r.seller_user_id=u then raise exception 'Нельзя купить собственную карточку.'; end if;
  delete from public.zf_card_inventory
    where user_id=r.seller_user_id and club_id=r.seller_club_id and card_id=(r.card_snapshot->>'id') and status='listed'
    returning * into seller_card;
  if not found then raise exception 'Карточка продавца не найдена в инвентаре. Обнови рынок и попробуй снова.'; end if;
  update public.zf_market_listings set status='sold',buyer_user_id=u,updated_at=now() where id=p_listing returning * into r;
  insert into public.zf_card_inventory(user_id,club_id,card_id,card_snapshot,status,is_starter)
    values(u,club_key,seller_card.card_id,seller_card.card_snapshot,'owned',false)
    on conflict(user_id,club_id,card_id) do update set card_snapshot=excluded.card_snapshot,status='owned',is_starter=false,updated_at=now();
  insert into public.zf_market_proceeds(listing_id,seller_user_id,club_id,amount)
    values(r.id,r.seller_user_id,r.seller_club_id,r.price_coins);
  return jsonb_build_object('listing',to_jsonb(r),'card',seller_card.card_snapshot,'price',r.price_coins,'club_id',club_key);
end $$;
revoke all on function public.zf_market_buy(uuid,text) from public;
grant execute on function public.zf_market_buy(uuid,text) to authenticated;

create or replace function public.zf_market_withdraw(p_listing uuid,p_club_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.zf_market_listings; card public.zf_card_inventory; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 then raise exception 'Не указан активный клуб.'; end if;
  select * into r from public.zf_market_listings
    where id=p_listing and seller_user_id=u and seller_club_id=club_key and status='active' for update;
  if not found then raise exception 'Нельзя снять эту карточку с продажи из текущего клуба.'; end if;
  update public.zf_card_inventory set status='owned',updated_at=now()
    where user_id=u and club_id=club_key and card_id=(r.card_snapshot->>'id') and status='listed'
    returning * into card;
  if not found then raise exception 'Карточка не найдена в инвентаре. Обнови рынок.'; end if;
  update public.zf_market_listings set status='withdrawn',updated_at=now() where id=p_listing;
  return jsonb_build_object('card',card.card_snapshot,'is_duplicate',r.is_duplicate);
end $$;
revoke all on function public.zf_market_withdraw(uuid,text) from public;
grant execute on function public.zf_market_withdraw(uuid,text) to authenticated;

create or replace function public.zf_market_my(p_club_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb; proceeds jsonb; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 then raise exception 'Не указан активный клуб.'; end if;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc),'[]'::jsonb) into items
    from public.zf_market_listings m where m.seller_user_id=u and m.seller_club_id=club_key;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc),'[]'::jsonb) into proceeds
    from public.zf_market_proceeds p where p.seller_user_id=u and p.club_id=club_key and not p.claimed;
  return jsonb_build_object('listings',items,'proceeds',proceeds,'club_id',club_key);
end $$;
revoke all on function public.zf_market_my(text) from public;
grant execute on function public.zf_market_my(text) to authenticated;

create or replace function public.zf_market_claim_proceeds(p_club_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); total numeric; club_key text:=nullif(trim(p_club_id),'');
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if club_key is null or length(club_key)>120 then raise exception 'Не указан активный клуб.'; end if;
  with claimed_rows as (
    update public.zf_market_proceeds set claimed=true
    where seller_user_id=u and club_id=club_key and not claimed returning amount
  ) select coalesce(sum(amount),0) into total from claimed_rows;
  return jsonb_build_object('amount',total,'club_id',club_key);
end $$;
revoke all on function public.zf_market_claim_proceeds(text) from public;
grant execute on function public.zf_market_claim_proceeds(text) to authenticated;

commit;
