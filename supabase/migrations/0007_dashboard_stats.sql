-- supabase/migrations/0007_dashboard_stats.sql
-- تحديث دالة إحصائيات لوحة التحكم dashboard_stats(p_from date, p_to date)
-- بصلاحية المستدعي security_invoker وتجميع كافة مؤشرات اللوحة من قاعدة البيانات مباشرة
-- واستثناء الطلبات المحذوفة ناعماً (deleted_at is not null)

create or replace function dashboard_stats(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_result jsonb;
begin
  with req_scoped as (
    select
      r.id,
      r.code,
      r.request_date,
      to_char(r.request_date, 'YYYY-MM') as yyyy_mm,
      coalesce(nullif(trim(r.entity), ''), 'دائرة غير محددة') as entity,
      coalesce(nullif(trim(r.department), ''), 'قسم غير محدد') as department,
      coalesce(nullif(trim(r.requester), ''), 'مقدم طلب غير محدد') as requester,
      r.status,
      count(i.id)::int as items_count,
      coalesce(sum(i.line_total), 0)::numeric(20,2) as req_amount
    from requests r
    left join request_items i on i.request_id = r.id
    where r.deleted_at is null
      and (p_from is null or r.request_date >= p_from)
      and (p_to is null or r.request_date <= p_to)
    group by r.id, r.code, r.request_date, r.entity, r.department, r.requester, r.status
  ),
  overall_totals as (
    select
      coalesce(count(*), 0)::int as total_requests,
      coalesce(sum(items_count), 0)::int as total_items,
      coalesce(sum(req_amount), 0)::numeric(20,2) as total_amount,
      coalesce(count(*) filter (where status = 'pending'), 0)::int as pending_count,
      coalesce(sum(req_amount) filter (where status = 'pending'), 0)::numeric(20,2) as pending_amount,
      coalesce(count(*) filter (where status = 'executed'), 0)::int as executed_count,
      coalesce(sum(req_amount) filter (where status = 'executed'), 0)::numeric(20,2) as executed_amount,
      coalesce(count(*) filter (where status = 'on_hold'), 0)::int as on_hold_count,
      coalesce(sum(req_amount) filter (where status = 'on_hold'), 0)::numeric(20,2) as on_hold_amount,
      coalesce(count(*) filter (where status = 'rejected'), 0)::int as rejected_count,
      coalesce(sum(req_amount) filter (where status = 'rejected'), 0)::numeric(20,2) as rejected_amount,
      coalesce(count(*) filter (where status = 'cancelled'), 0)::int as cancelled_count,
      coalesce(sum(req_amount) filter (where status = 'cancelled'), 0)::numeric(20,2) as cancelled_amount
    from req_scoped
  ),
  status_rows as (
    select
      st.status,
      case st.status
        when 'pending' then 'قيد الانتظار'
        when 'executed' then 'تم التنفيذ'
        when 'on_hold' then 'تريث'
        when 'rejected' then 'مرفوض'
        when 'cancelled' then 'ملغى'
        else st.status
      end as label,
      coalesce(count(r.id), 0)::int as count,
      coalesce(sum(r.req_amount), 0)::numeric(20,2) as amount,
      case
        when (select total_requests from overall_totals) > 0 then
          round((count(r.id)::numeric / (select total_requests from overall_totals)) * 100, 1)
        else 0
      end as percentage
    from (values ('pending'), ('executed'), ('on_hold'), ('rejected'), ('cancelled')) as st(status)
    left join req_scoped r on r.status = st.status
    group by st.status
    order by array_position(array['pending','executed','on_hold','rejected','cancelled'], st.status)
  ),
  monthly_rows as (
    select
      yyyy_mm as month,
      count(*)::int as count,
      coalesce(sum(items_count), 0)::int as items_count,
      coalesce(sum(req_amount), 0)::numeric(20,2) as amount
    from req_scoped
    where yyyy_mm is not null
    group by yyyy_mm
    order by yyyy_mm asc
  ),
  top_entity_rows as (
    select
      entity,
      count(*)::int as count,
      coalesce(sum(req_amount), 0)::numeric(20,2) as amount
    from req_scoped
    group by entity
    order by amount desc, count desc
    limit 5
  ),
  top_dept_rows as (
    select
      department,
      count(*)::int as count,
      coalesce(sum(req_amount), 0)::numeric(20,2) as amount
    from req_scoped
    group by department
    order by amount desc, count desc
    limit 5
  ),
  top_req_rows as (
    select
      requester,
      count(*)::int as count,
      coalesce(sum(req_amount), 0)::numeric(20,2) as amount
    from req_scoped
    group by requester
    order by amount desc, count desc
    limit 5
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'requests', ot.total_requests,
      'items', ot.total_items,
      'amount', ot.total_amount
    ),
    'total_requests', ot.total_requests,
    'total_items', ot.total_items,
    'total_amount', ot.total_amount,
    'pending_count', ot.pending_count,
    'pending_amount', ot.pending_amount,
    'executed_count', ot.executed_count,
    'executed_amount', ot.executed_amount,
    'on_hold_count', ot.on_hold_count,
    'on_hold_amount', ot.on_hold_amount,
    'rejected_count', ot.rejected_count,
    'rejected_amount', ot.rejected_amount,
    'cancelled_count', ot.cancelled_count,
    'cancelled_amount', ot.cancelled_amount,
    'statuses', coalesce((select jsonb_agg(s) from status_rows s), '[]'::jsonb),
    'status_distribution', coalesce((select jsonb_agg(s) from status_rows s), '[]'::jsonb),
    'monthly', coalesce((select jsonb_agg(m) from monthly_rows m), '[]'::jsonb),
    'monthly_distribution', coalesce((select jsonb_agg(m) from monthly_rows m), '[]'::jsonb),
    'top_entities', coalesce((select jsonb_agg(e) from top_entity_rows e), '[]'::jsonb),
    'top_departments', coalesce((select jsonb_agg(d) from top_dept_rows d), '[]'::jsonb),
    'top_requesters', coalesce((select jsonb_agg(q) from top_req_rows q), '[]'::jsonb)
  )
  into v_result
  from overall_totals ot;

  return v_result;
end;
$$;
