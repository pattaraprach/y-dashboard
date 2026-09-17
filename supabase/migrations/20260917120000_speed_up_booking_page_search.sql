-- Leading-wildcard ILIKE on many booking columns forced a sequential scan, and
-- the page function counted the filtered set in a second pass. Trigram indexes
-- make contains-search indexable; MATERIALIZED keeps the count on one scan.
--
-- Rollback: migrations are forward-only. Add a new migration to drop these
-- indexes and restore the prior cad_yip_booking_page body if required.

create extension if not exists pg_trgm with schema extensions;

create index if not exists cad_yip_bookings_sku_trgm
  on public.cad_yip_bookings
  using gin (sku extensions.gin_trgm_ops);

create index if not exists cad_yip_bookings_woo_id_idx
  on public.cad_yip_bookings (woo_id);

create index if not exists cad_yip_bookings_search_trgm
  on public.cad_yip_bookings
  using gin (
    (
      concat_ws(
        ' ',
        woo_id::text,
        firstname,
        lastname,
        email,
        seat,
        pickup_loc,
        zone_code,
        zone
      )
    ) extensions.gin_trgm_ops
  );

create or replace function public.cad_yip_booking_page(
  p_event_code text,
  p_page_index integer default 0,
  p_page_size integer default 25,
  p_status text default 'active',
  p_rsh text default 'all',
  p_event_date text default null,
  p_search text default null,
  p_sort_column text default 'woo_id',
  p_sort_desc boolean default true
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_page_index integer := greatest(coalesce(p_page_index, 0), 0);
  v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 10000);
  v_search text := btrim(coalesce(p_search, ''));
  v_sort_column text;
  v_woo_id bigint;
begin
  if p_event_code is null or p_event_code not in ('CADCNX', 'CADNYE') then
    raise exception 'Invalid dashboard event code: %', p_event_code
      using errcode = '22023';
  end if;

  v_sort_column := case p_sort_column
    when 'woo_id' then 'woo_id'
    when 'name' then 'name'
    when 'email' then 'email'
    when 'event_date' then 'event_date'
    when 'zone_code' then 'zone_code'
    when 'amount' then 'amount'
    when 'seat' then 'seat'
    when 'pickup_loc' then 'pickup_loc'
    when 'order_created_at' then 'order_created_at'
    else 'woo_id'
  end;

  v_search := replace(
    replace(
      replace(v_search, chr(92), chr(92) || chr(92)),
      '%', chr(92) || '%'
    ),
    '_', chr(92) || '_'
  );

  v_woo_id := case
    when v_search ~ '^\d{1,18}$' then v_search::bigint
    else null
  end;

  return (
    with filtered as materialized (
      select b.*
      from public.cad_yip_bookings b
      where b.sku ilike '%' || p_event_code || '%'
        and (
          p_status = 'all'
          or (p_status = 'active' and not coalesce(b.is_cancelled, false))
          or (p_status = 'cancelled' and coalesce(b.is_cancelled, false))
        )
        and (
          p_rsh = 'all'
          or (p_rsh = 'rsh' and b.is_rsh_transfer)
          or (p_rsh = 'non-rsh' and not b.is_rsh_transfer)
        )
        and (p_event_date is null or b.event_date::text = p_event_date)
        and (
          v_search = ''
          or (v_woo_id is not null and b.woo_id = v_woo_id)
          or concat_ws(
            ' ',
            b.woo_id::text,
            b.firstname,
            b.lastname,
            b.email,
            b.seat,
            b.pickup_loc,
            b.zone_code,
            b.zone
          ) ilike '%' || v_search || '%' escape E'\\'
        )
    ),
    paged as (
      select
        id,
        created_at,
        order_created_at,
        woo_id,
        firstname,
        lastname,
        email,
        phone_raw,
        phone_e164,
        country,
        sku,
        seat,
        is_rsh_transfer,
        pickup_loc,
        child_count,
        amount,
        commission,
        fees,
        gateway,
        event_date,
        zone_code,
        zone,
        event_type,
        is_cancelled,
        quantity,
        pickup_type,
        pickup_link,
        amount_refunded,
        amount_net,
        woo_status,
        refund_status,
        cancel_source,
        cancelled_at,
        refunded_at,
        last_synced_at
      from filtered
      order by
        case when v_sort_column = 'woo_id' and p_sort_desc then woo_id end desc nulls last,
        case when v_sort_column = 'woo_id' and not p_sort_desc then woo_id end asc nulls last,
        case when v_sort_column = 'name' and p_sort_desc then lower(coalesce(firstname, '') || ' ' || coalesce(lastname, '')) end desc nulls last,
        case when v_sort_column = 'name' and not p_sort_desc then lower(coalesce(firstname, '') || ' ' || coalesce(lastname, '')) end asc nulls last,
        case when v_sort_column = 'email' and p_sort_desc then email end desc nulls last,
        case when v_sort_column = 'email' and not p_sort_desc then email end asc nulls last,
        case when v_sort_column = 'event_date' and p_sort_desc then event_date end desc nulls last,
        case when v_sort_column = 'event_date' and not p_sort_desc then event_date end asc nulls last,
        case when v_sort_column = 'zone_code' and p_sort_desc then zone_code end desc nulls last,
        case when v_sort_column = 'zone_code' and not p_sort_desc then zone_code end asc nulls last,
        case when v_sort_column = 'amount' and p_sort_desc then amount end desc nulls last,
        case when v_sort_column = 'amount' and not p_sort_desc then amount end asc nulls last,
        case when v_sort_column = 'seat' and p_sort_desc then seat end desc nulls last,
        case when v_sort_column = 'seat' and not p_sort_desc then seat end asc nulls last,
        case when v_sort_column = 'pickup_loc' and p_sort_desc then pickup_loc end desc nulls last,
        case when v_sort_column = 'pickup_loc' and not p_sort_desc then pickup_loc end asc nulls last,
        case when v_sort_column = 'order_created_at' and p_sort_desc then coalesce(order_created_at, created_at) end desc nulls last,
        case when v_sort_column = 'order_created_at' and not p_sort_desc then coalesce(order_created_at, created_at) end asc nulls last,
        id desc
      limit v_page_size
      offset v_page_index * v_page_size
    )
    select jsonb_build_object(
      'bookings', coalesce((
        select jsonb_agg(to_jsonb(p)) from paged p
      ), '[]'::jsonb),
      'total', (select count(*) from filtered)
    )
  );
end;
$function$;
