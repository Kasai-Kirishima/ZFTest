-- Zero Football v67: repair transfer-market duplicate flag and keep it non-null.
-- Run after migrations 001, 002, 003 and 004.

begin;

alter table public.zf_market_listings
  add column if not exists is_duplicate boolean;

update public.zf_market_listings
set is_duplicate = coalesce((card_snapshot->>'marketResaleOnly') = 'true', false)
where is_duplicate is null;

alter table public.zf_market_listings
  alter column is_duplicate set default false,
  alter column is_duplicate set not null;

create or replace function public.zf_market_list(p_card_id text,p_price numeric,p_duplicate boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  u uuid := auth.uid();
  card public.zf_card_inventory;
  r public.zf_market_listings;
  duplicate_flag boolean;
begin
  if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
  if p_card_id is null or length(trim(p_card_id)) = 0 or p_price is null or p_price <= 0 or p_price > 999999999999 then
    raise exception 'Некорректная карточка или цена.';
  end if;

  select * into card
  from public.zf_card_inventory
  where user_id = u and card_id = p_card_id
  for update;

  if not found or card.status <> 'owned' then raise exception 'Карточка уже выставлена или передана.'; end if;
  if card.is_starter then raise exception 'Футболиста из стартового состава нельзя выставить.'; end if;

  -- The JSON comparison can return NULL when the property is absent.
  -- Coalesce both operands before inserting into the NOT NULL column.
  duplicate_flag := coalesce(p_duplicate, false)
    or coalesce((card.card_snapshot->>'marketResaleOnly') = 'true', false);

  insert into public.zf_market_listings(
    seller_user_id, card_snapshot, card_name, card_rating, price_coins, is_duplicate
  ) values (
    u,
    card.card_snapshot,
    left(coalesce(card.card_snapshot->>'name', 'Футболист'), 80),
    greatest(1, least(99, coalesce(nullif(card.card_snapshot->>'rating', '')::integer, 1))),
    p_price,
    coalesce(duplicate_flag, false)
  ) returning * into r;

  update public.zf_card_inventory
  set status = 'listed', updated_at = now()
  where user_id = u and card_id = p_card_id;

  return to_jsonb(r);
end;
$$;

revoke all on function public.zf_market_list(text,numeric,boolean) from public;
grant execute on function public.zf_market_list(text,numeric,boolean) to authenticated;

commit;
