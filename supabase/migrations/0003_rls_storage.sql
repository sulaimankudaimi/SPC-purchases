-- supabase/migrations/0003_rls_storage.sql
-- سياسات الأمان على مستوى الصفوف (RLS) وإعداد حاويات التخزين الخاصة (القرارات D5 وD10)

-- 1. تفعيل RLS على جميع الجداول الخمسة
alter table requests enable row level security;
alter table request_items enable row level security;
alter table lookups enable row level security;
alter table settings enable row level security;
alter table audit_log enable row level security;

-- 2. سياسات جدول الطلبات (requests) - للمستخدمين الموثَّقين فقط
create policy "requests_select_auth" on requests
  for select to authenticated
  using (true);

create policy "requests_insert_auth" on requests
  for insert to authenticated
  with check (true);

create policy "requests_update_auth" on requests
  for update to authenticated
  using (true)
  with check (true);

create policy "requests_delete_auth" on requests
  for delete to authenticated
  using (true);

-- 3. سياسات جدول مواد الطلب (request_items) - للمستخدمين الموثَّقين فقط
create policy "request_items_select_auth" on request_items
  for select to authenticated
  using (true);

create policy "request_items_insert_auth" on request_items
  for insert to authenticated
  with check (true);

create policy "request_items_update_auth" on request_items
  for update to authenticated
  using (true)
  with check (true);

create policy "request_items_delete_auth" on request_items
  for delete to authenticated
  using (true);

-- 4. سياسات جدول القوائم المرجعية (lookups) - للمستخدمين الموثَّقين فقط
create policy "lookups_select_auth" on lookups
  for select to authenticated
  using (true);

create policy "lookups_insert_auth" on lookups
  for insert to authenticated
  with check (true);

create policy "lookups_update_auth" on lookups
  for update to authenticated
  using (true)
  with check (true);

create policy "lookups_delete_auth" on lookups
  for delete to authenticated
  using (true);

-- 5. سياسات جدول الإعدادات (settings) - للمستخدمين الموثَّقين فقط
create policy "settings_select_auth" on settings
  for select to authenticated
  using (true);

create policy "settings_insert_auth" on settings
  for insert to authenticated
  with check (true);

create policy "settings_update_auth" on settings
  for update to authenticated
  using (true)
  with check (true);

create policy "settings_delete_auth" on settings
  for delete to authenticated
  using (true);

-- 6. سياسات جدول سجل التدقيق (audit_log) - قراءة للموثَّقين والكتابة عبر المحفّزات فقط
create policy "audit_log_select_auth" on audit_log
  for select to authenticated
  using (true);

-- 7. إنشاء حاويتي التخزين الخاصتين (D10)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('request-pdfs', 'request-pdfs', false, 52428800, array['application/pdf']),
  ('invoices', 'invoices', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = false;

-- 8. سياسات حاويات التخزين للمستخدمين الموثَّقين فقط
create policy "storage_spc_select_auth" on storage.objects
  for select to authenticated
  using (bucket_id in ('request-pdfs', 'invoices'));

create policy "storage_spc_insert_auth" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('request-pdfs', 'invoices'));

create policy "storage_spc_update_auth" on storage.objects
  for update to authenticated
  using (bucket_id in ('request-pdfs', 'invoices'));

create policy "storage_spc_delete_auth" on storage.objects
  for delete to authenticated
  using (bucket_id in ('request-pdfs', 'invoices'));
