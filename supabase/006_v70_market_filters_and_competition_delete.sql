-- Zero Football v70: exact-name transfer search and owner-only competition deletion.
-- Run after migrations 001-005 in Supabase SQL Editor.

-- Search by partial name by default, or exact card/player name when p_exact=true.
-- Remove the previous one-argument signature to avoid RPC overload ambiguity.
drop function if exists public.zf_market_search(text);
create or replace function public.zf_market_search(p_search text default '', p_exact boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); items jsonb; q text:=trim(coalesce(p_search,''));
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',m.id,'seller_user_id',m.seller_user_id,'seller_name',p.display_name,
   'seller_code',p.player_code,'card_snapshot',m.card_snapshot,'card_name',m.card_name,
   'card_rating',m.card_rating,'price_coins',m.price_coins,'is_duplicate',m.is_duplicate,
   'created_at',m.created_at
 ) order by m.created_at desc),'[]'::jsonb)
 into items
 from public.zf_market_listings m
 join public.zf_player_profiles p on p.user_id=m.seller_user_id
 where m.status='active' and m.seller_user_id<>u
   and (q='' or (p_exact and lower(m.card_name)=lower(q)) or (not p_exact and m.card_name ilike '%'||q||'%'));
 return items;
end $$;
revoke all on function public.zf_market_search(text,boolean) from public;
grant execute on function public.zf_market_search(text,boolean) to authenticated;

-- Only the creator can delete their league or knockout tournament.
-- Related members, invites, matches and results are removed by FK ON DELETE CASCADE.
create or replace function public.zf_competition_delete(p_competition uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); removed_id uuid;
begin
 if u is null then raise exception 'Необходимо войти в аккаунт.'; end if;
 delete from public.zf_competitions
  where id=p_competition and owner_user_id=u
  returning id into removed_id;
 if removed_id is null then raise exception 'Соревнование не найдено или ты не являешься его создателем.'; end if;
 return jsonb_build_object('deleted',true,'competition_id',removed_id);
end $$;
revoke all on function public.zf_competition_delete(uuid) from public;
grant execute on function public.zf_competition_delete(uuid) to authenticated;
