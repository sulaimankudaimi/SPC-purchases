-- supabase/migrations/0002_functions.sql
-- الدوال والمشاهد والمحفّزات المعتمدة (القسم 4 والقرارات D3 وD4 وO3)

-- 1. مشهد إجماليات الطلبات (request_totals) بصلاحية المستدعي security_invoker
create or replace view request_totals
with (security_invoker = true) as
select
  r.id as request_id,
  r.code,
  r.request_date,
  r.status,
  r.deleted_at,
  coalesce(count(i.id), 0)::int as items_count,
  coalesce(sum(i.line_total), 0)::numeric(20,2) as total_amount
from requests r
left join request_items i on i.request_id = r.id
group by r.id, r.code, r.request_date, r.status, r.deleted_at;

-- 2. دالة توليد رمز الطلب التالي بصيغة D3: «spc D-M-YY (n)» بقفل استشاري
create or replace function next_request_code(p_date date)
returns text
language plpgsql
security definer
as $$
declare
  v_day text;
  v_month text;
  v_year text;
  v_prefix text;
  v_next_n int;
  v_code text;
begin
  -- قفل استشاري يمنع التضارب وحجز نفس الرمز بالتزامن لنفس اليوم
  perform pg_advisory_xact_lock(hashtext('next_request_code_' || p_date::text));

  -- استخراج اليوم والشهر بلا أصفار بادئة (FMDD, FMMM) والسنة برقمين (YY)
  v_day := to_char(p_date, 'FMDD');
  v_month := to_char(p_date, 'FMMM');
  v_year := to_char(p_date, 'YY');
  v_prefix := 'spc ' || v_day || '-' || v_month || '-' || v_year;

  -- حساب التسلسل n التالي لهذا اليوم داخل قاعدة البيانات
  select coalesce(
    max(coalesce(nullif(substring(code from '\((\d+)\)\s*$'), '')::int, 1)),
    0
  ) + 1
  into v_next_n
  from requests
  where request_date = p_date;

  v_code := v_prefix || ' (' || v_next_n || ')';
  return v_code;
end;
$$;

-- 3. دالة محفّز تحديث updated_at تلقائياً
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_requests_updated_at
before update on requests
for each row
execute function handle_updated_at();

-- 4. دالة ومحفّز تسجيل تغيّر حالة الطلب في audit_log
create or replace function handle_request_status_audit()
returns trigger
language plpgsql
security definer
as $$
begin
  if (old.status is distinct from new.status) then
    insert into audit_log (
      request_id,
      action,
      old,
      new,
      at,
      by
    ) values (
      new.id,
      'status_change',
      jsonb_build_object(
        'status', old.status,
        'status_note', old.status_note
      ),
      jsonb_build_object(
        'status', new.status,
        'status_note', new.status_note
      ),
      now(),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create or replace trigger trg_requests_status_audit
after update on requests
for each row
execute function handle_request_status_audit();

-- 5. دالة إحصائيات لوحة التحكم dashboard_stats(p_from date, p_to date)
create or replace function dashboard_stats(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_from date := coalesce(p_from, '1970-01-01'::date);
  v_to date := coalesce(p_to, '2099-12-31'::date);
  v_result jsonb;
begin
  with filtered_requests as (
    select r.*, coalesce(rt.total_amount, 0) as total_amount, coalesce(rt.items_count, 0) as items_count
    from requests r
    left join request_totals rt on rt.request_id = r.id
    where r.deleted_at is null
      and r.request_date between v_from and v_to
  ),
  status_counts as (
    select
      count(*)::int as total_requests,
      coalesce(sum(total_amount), 0)::numeric(20,2) as total_amount,
      count(*) filter (where status = 'pending')::int as pending_count,
      coalesce(sum(total_amount) filter (where status = 'pending'), 0)::numeric(20,2) as pending_amount,
      count(*) filter (where status = 'executed')::int as executed_count,
      coalesce(sum(total_amount) filter (where status = 'executed'), 0)::numeric(20,2) as executed_amount,
      count(*) filter (where status = 'on_hold')::int as on_hold_count,
      count(*) filter (where status = 'rejected')::int as rejected_count,
      count(*) filter (where status = 'cancelled')::int as cancelled_count
    from filtered_requests
  ),
  status_dist as (
    select jsonb_agg(
      jsonb_build_object(
        'status', s.status,
        'count', s.cnt,
        'percentage', round((s.cnt::numeric / nullif(tot.total_requests, 0)) * 100, 1)
      )
    ) as status_distribution
    from (
      select status, count(*)::int as cnt
      from filtered_requests
      group by status
    ) s, status_counts tot
  ),
  top_depts as (
    select coalesce(jsonb_agg(d), '[]'::jsonb) as top_departments
    from (
      select coalesce(department, 'غير محدد') as department, coalesce(sum(total_amount), 0)::numeric(20,2) as total_amount, count(*)::int as count
      from filtered_requests
      group by department
      order by total_amount desc
      limit 5
    ) d
  ),
  top_reqs as (
    select coalesce(jsonb_agg(q), '[]'::jsonb) as top_requesters
    from (
      select requester, count(*)::int as count, coalesce(sum(total_amount), 0)::numeric(20,2) as total_amount
      from filtered_requests
      group by requester
      order by count desc
      limit 5
    ) q
  )
  select jsonb_build_object(
    'total_requests', sc.total_requests,
    'total_amount', sc.total_amount,
    'pending_count', sc.pending_count,
    'pending_amount', sc.pending_amount,
    'executed_count', sc.executed_count,
    'executed_amount', sc.executed_amount,
    'on_hold_count', sc.on_hold_count,
    'rejected_count', sc.rejected_count,
    'cancelled_count', sc.cancelled_count,
    'status_distribution', coalesce(sd.status_distribution, '[]'::jsonb),
    'top_departments', td.top_departments,
    'top_requesters', tr.top_requesters
  )
  into v_result
  from status_counts sc
  cross join status_dist sd
  cross join top_depts td
  cross join top_reqs tr;

  return v_result;
end;
$$;
