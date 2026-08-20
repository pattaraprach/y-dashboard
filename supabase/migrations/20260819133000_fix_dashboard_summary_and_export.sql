-- Follow-up for environments where 20260819090000 was already applied.
-- Fresh installs already contain these final definitions in that migration.
do $migration$
declare
  summary_sql text;
  page_sql text;
  old_child_sql constant text := 'attendee_count + greatest(coalesce(child_count, 0), 0)';
  new_child_sql constant text := $replacement$attendee_count + case
      when coalesce(child_count, 0) > 0 then child_count
      else coalesce(
        (substring(coalesce(seat, '') from '(?i)\+\s*([0-9]+)\s*C'))::integer,
        0
      )
    end$replacement$;
  old_page_size constant text := 'least(greatest(p_page_size, 1), 100)';
  new_page_size constant text := 'least(greatest(p_page_size, 1), 10000)';
begin
  summary_sql := pg_get_functiondef(
    'public.cad_yip_dashboard_summary(text)'::regprocedure
  );
  if position(old_child_sql in summary_sql) > 0 then
    execute replace(summary_sql, old_child_sql, new_child_sql);
  end if;

  page_sql := pg_get_functiondef(
    'public.cad_yip_booking_page(text,integer,integer,text,text,text,text)'::regprocedure
  );
  if position(old_page_size in page_sql) > 0 then
    execute replace(page_sql, old_page_size, new_page_size);
  end if;
end;
$migration$;
