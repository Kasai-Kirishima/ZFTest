-- Zero Football v109: reconcile server inventory with the active local club roster.
-- Run this once in Supabase SQL Editor after migrations 001-007.
-- Stale rows in status=owned are removed; listed/offered cards are preserved.

begin;

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

  -- A sold/removed card must not stay "owned" and reappear on a later sync.
  -- Listed and offered cards are intentionally preserved in their own states.
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
  return jsonb_build_object('synced',n,'club_id',club_key,'removed_stale_owned',true);
end $$;

revoke all on function public.zf_card_inventory_sync(jsonb,jsonb,text) from public;
grant execute on function public.zf_card_inventory_sync(jsonb,jsonb,text) to authenticated;

commit;
