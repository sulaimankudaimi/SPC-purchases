-- supabase/migrations/0005_selftest.sql
-- دالة الفحص الذاتي للمشروع التجريبي فقط (قاعدة X3)
-- تتحقق من سلامة المخطط وRLS وحالة الحاويات وصلاحيات دور anon

create or replace function selftest_schema()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
  v_tables jsonb;
  v_rls jsonb;
  v_buckets jsonb;
  v_anon_grants jsonb;
  v_functions jsonb;
begin
  -- 1. فحص وجود الجداول الخمسة
  select jsonb_agg(
    jsonb_build_object(
      'table_name', t.t_name,
      'exists', (select exists (
        select 1 from information_schema.tables 
        where table_schema = 'public' and table_name = t.t_name
      ))
    )
  )
  into v_tables
  from (values 
    ('requests'), 
    ('request_items'), 
    ('lookups'), 
    ('settings'), 
    ('audit_log')
  ) as t(t_name);

  -- 2. فحص حالة تفعيل RLS على كل جدول
  select jsonb_agg(
    jsonb_build_object(
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity
    )
  )
  into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('requests', 'request_items', 'lookups', 'settings', 'audit_log');

  -- 3. فحص حاويتي التخزين وحالة كونها خاصة (public = false)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'bucket_id', b.id,
      'exists', true,
      'is_public', b.public
    )
  ), '[]'::jsonb)
  into v_buckets
  from storage.buckets b
  where b.id in ('request-pdfs', 'invoices');

  -- 4. فحص صلاحيات دور anon على الجداول في public (للتأكد من منع الوصول غير المصرح به)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'table_name', table_name,
      'privilege_type', privilege_type
    )
  ), '[]'::jsonb)
  into v_anon_grants
  from information_schema.role_table_grants
  where grantee = 'anon'
    and table_schema = 'public'
    and table_name in ('requests', 'request_items', 'lookups', 'settings', 'audit_log');

  -- 5. فحص وجود الدوال والمشاهد المعتمدة
  select jsonb_build_object(
    'request_totals_view', (select exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'request_totals')),
    'next_request_code_fn', (select exists (select 1 from information_schema.routines where routine_schema = 'public' and routine_name = 'next_request_code')),
    'dashboard_stats_fn', (select exists (select 1 from information_schema.routines where routine_schema = 'public' and routine_name = 'dashboard_stats'))
  )
  into v_functions;

  v_result := jsonb_build_object(
    'checked_at', now(),
    'tables', v_tables,
    'rls_status', v_rls,
    'storage_buckets', v_buckets,
    'anon_grants', v_anon_grants,
    'functions_and_views', v_functions
  );

  return v_result;
end;
$$;

-- السماح باستدعاء دالة الفحص الذاتي للمشروع التجريبي
grant execute on function selftest_schema() to anon, authenticated;
