-- Forward-only follow-up: already-applied dashboard migrations remain immutable.
-- Replaces the dashboard RPCs with their complete final definitions.

alter table public.cad_yip_bookings enable row level security;
alter table public.cad_yip_attendees enable row level security;

drop policy if exists dashboard_authenticated_select on public.cad_yip_bookings;
drop policy if exists dashboard_authenticated_select on public.cad_yip_attendees;
drop policy if exists dashboard_authenticated_update on public.cad_yip_bookings;
drop policy if exists cad_yip_bookings_select_authenticated on public.cad_yip_bookings;
drop policy if exists cad_yip_attendees_select_authenticated on public.cad_yip_attendees;
drop policy if exists cad_yip_bookings_update_authenticated on public.cad_yip_bookings;

create policy cad_yip_bookings_select_authenticated
  on public.cad_yip_bookings for select to authenticated using (true);
create policy cad_yip_attendees_select_authenticated
  on public.cad_yip_attendees for select to authenticated using (true);
create policy cad_yip_bookings_update_authenticated
  on public.cad_yip_bookings for update to authenticated
  using (true) with check (true);

create or replace function public.cad_yip_dashboard_summary(p_event_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_event_code is null or p_event_code not in ('CADCNX', 'CADNYE') then
    raise exception 'Invalid dashboard event code: %', p_event_code
      using errcode = '22023';
  end if;

  return (
    with booking_base as (
      select
        b.id,
        b.created_at,
        b.order_created_at,
        b.sku,
        b.seat,
        b.is_rsh_transfer,
        b.child_count,
        b.amount,
        b.commission,
        b.fees,
        b.event_date,
        b.event_type,
        b.is_cancelled,
        coalesce(b.order_created_at, b.created_at) as sold_at,
        count(a.id)::integer as attendee_count
      from public.cad_yip_bookings b
      left join public.cad_yip_attendees a on a.booking_id = b.id
      where b.sku ilike '%' || p_event_code || '%'
      group by b.id
    ),
    active as (
      select
        booking_base.*,
        case
          when coalesce(child_count, 0) > 0 then child_count
          else coalesce(
            (substring(coalesce(seat, '') from '(?i)\+\s*([0-9]+)\s*C'))::integer,
            0
          )
        end as effective_child_count
      from booking_base
      where not coalesce(is_cancelled, false)
    ),
    totals as (
      select
        count(*)::integer as total_orders,
        coalesce(sum(attendee_count), 0)::integer as total_guests,
        coalesce(sum(amount), 0)::numeric as total_amount,
        coalesce(sum(commission), 0)::numeric as total_commission,
        coalesce(sum(fees), 0)::numeric as total_fees,
        coalesce(sum(
          case
            when is_rsh_transfer then attendee_count + effective_child_count
            else 0
          end
        ), 0)::integer as rsh_attendees
      from active
    ),
    rsh_days as (
      select
        coalesce(event_date::text, 'Unknown') as date,
        sum(attendee_count + effective_child_count)::integer as count
      from active
      where is_rsh_transfer
      group by coalesce(event_date::text, 'Unknown')
    ),
    event_groups as (
      select
        coalesce(event_type, 'Unknown') as event_type,
        sum(attendee_count)::integer as total_guests,
        count(*)::integer as total_orders,
        coalesce(sum(amount), 0)::numeric as total_amount,
        coalesce(sum(commission), 0)::numeric as total_commission
      from active
      group by coalesce(event_type, 'Unknown')
    ),
    daily_groups as (
      select
        (sold_at at time zone 'Asia/Bangkok')::date::text as date,
        sum(attendee_count)::integer as total_guests,
        count(*)::integer as total_orders,
        count(*) filter (where is_rsh_transfer)::integer as rsh_guests,
        count(*) filter (where not is_rsh_transfer)::integer as non_rsh_guests
      from active
      where sold_at is not null
      group by (sold_at at time zone 'Asia/Bangkok')::date
    ),
    ticket_groups as (
      select
        to_char(sold_at at time zone 'Asia/Bangkok', 'YYYY-MM') as month,
        coalesce(event_date::text, 'No Event Date') as event_date,
        coalesce(sku, 'Unknown') as sku,
        coalesce(event_type, 'Unknown') as event_type,
        count(*)::integer as quantity,
        coalesce(sum(amount), 0)::numeric as total_amount,
        coalesce(sum(commission), 0)::numeric as total_commission
      from active
      where sold_at is not null
      group by
        to_char(sold_at at time zone 'Asia/Bangkok', 'YYYY-MM'),
        coalesce(event_date::text, 'No Event Date'),
        coalesce(sku, 'Unknown'),
        coalesce(event_type, 'Unknown')
    ),
    event_days as (
      select
        month,
        event_date,
        jsonb_agg(
          jsonb_build_object(
            'sku', sku,
            'eventType', event_type,
            'quantity', quantity,
            'totalAmount', total_amount,
            'totalCommission', total_commission
          ) order by quantity desc
        ) as ticket_types,
        sum(quantity)::integer as total_orders,
        sum(total_amount)::numeric as total_amount,
        sum(total_commission)::numeric as total_commission
      from ticket_groups
      group by month, event_date
    ),
    months as (
      select
        month,
        to_char(to_date(month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY') as month_display,
        jsonb_agg(
          jsonb_build_object(
            'eventDate', event_date,
            'ticketTypes', ticket_types,
            'totalOrders', total_orders,
            'totalAmount', total_amount,
            'totalCommission', total_commission
          ) order by event_date
        ) as event_days,
        sum(total_orders)::integer as total_orders,
        sum(total_amount)::numeric as total_amount,
        sum(total_commission)::numeric as total_commission
      from event_days
      group by month
    ),
    slots as (
      select
        i,
        statement_timestamp() - ((24 - i) * interval '1 hour') as slot_start,
        statement_timestamp() - ((23 - i) * interval '1 hour') as slot_end
      from generate_series(0, 23) as i
    ),
    hourly as (
      select
        s.i,
        floor(extract(epoch from s.slot_start) * 1000)::bigint::text as slot_key,
        count(a.id)::integer as total_orders,
        count(a.id) filter (where a.is_rsh_transfer)::integer as rsh_orders,
        count(a.id) filter (where not a.is_rsh_transfer)::integer as non_rsh_orders,
        coalesce(sum(a.attendee_count), 0)::integer as total_guests
      from slots s
      left join active a on a.sold_at >= s.slot_start and a.sold_at < s.slot_end
      group by s.i, s.slot_start
    ),
    event_dates as (
      select distinct event_date
      from booking_base
      where event_date is not null
    )
    select jsonb_build_object(
      'generatedAt', statement_timestamp(),
      'metrics', jsonb_build_object(
        'totalOrders', t.total_orders,
        'totalGuests', t.total_guests,
        'totalAmount', t.total_amount,
        'totalCommission', t.total_commission,
        'totalFees', t.total_fees,
        'totalProfit', t.total_commission - t.total_fees,
        'estimatedProfitAfterVAT', (t.total_commission - t.total_fees) * 0.93,
        'rshAttendees', t.rsh_attendees,
        'rshAttendeesByDay', coalesce((
          select jsonb_agg(jsonb_build_object('date', date, 'count', count) order by date)
          from rsh_days
        ), '[]'::jsonb)
      ),
      'eventMetrics', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'eventType', event_type,
            'totalGuests', total_guests,
            'totalOrders', total_orders,
            'totalAmount', total_amount,
            'totalCommission', total_commission
          ) order by total_guests desc
        )
        from event_groups
      ), '[]'::jsonb),
      'dailyMetrics', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'date', date,
            'totalGuests', total_guests,
            'totalOrders', total_orders,
            'rshGuests', rsh_guests,
            'nonRshGuests', non_rsh_guests
          ) order by date
        )
        from daily_groups
      ), '[]'::jsonb),
      'hourlyMetrics', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'label', '',
            'slotKey', slot_key,
            'totalOrders', total_orders,
            'rshOrders', rsh_orders,
            'nonRshOrders', non_rsh_orders,
            'totalGuests', total_guests
          ) order by i
        )
        from hourly
      ), '[]'::jsonb),
      'monthlySummary', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'month', month,
            'monthDisplay', month_display,
            'eventDays', event_days,
            'totalOrders', total_orders,
            'totalAmount', total_amount,
            'totalCommission', total_commission
          ) order by month desc
        )
        from months
      ), '[]'::jsonb),
      'availableEventDates', coalesce((
        select jsonb_agg(event_date order by event_date) from event_dates
      ), '[]'::jsonb)
    )
    from totals t
  );
end;
$function$;

drop function if exists public.cad_yip_booking_page(text, integer, integer, text, text, text, text);

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

  return (
    with filtered as (
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
          or b.woo_id::text ilike '%' || v_search || '%' escape E'\\'
          or b.firstname ilike '%' || v_search || '%' escape E'\\'
          or b.lastname ilike '%' || v_search || '%' escape E'\\'
          or b.email ilike '%' || v_search || '%' escape E'\\'
          or coalesce(b.seat, '') ilike '%' || v_search || '%' escape E'\\'
          or coalesce(b.pickup_loc, '') ilike '%' || v_search || '%' escape E'\\'
          or coalesce(b.event_date::text, '') ilike '%' || v_search || '%' escape E'\\'
          or coalesce(b.zone_code, '') ilike '%' || v_search || '%' escape E'\\'
          or coalesce(b.zone, '') ilike '%' || v_search || '%' escape E'\\'
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

revoke execute on function public.cad_yip_dashboard_summary(text) from public, anon;
revoke execute on function public.cad_yip_booking_page(text, integer, integer, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.cad_yip_dashboard_summary(text) to authenticated, service_role;
grant execute on function public.cad_yip_booking_page(text, integer, integer, text, text, text, text, text, boolean) to authenticated, service_role;

-- Rollback: migrations are forward-only. If required, apply a new migration
-- that restores the prior function definitions and policies.
