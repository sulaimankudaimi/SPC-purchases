-- supabase/migrations/0001_schema.sql
-- نموذج البيانات المعتمد (القسم 4 من الخطة) حرفياً دون أي تغيير في الأسماء أو الأعمدة أو القيود

create extension if not exists "pgcrypto";

-- 1. جدول الطلبات الرئيسية (requests)
create table requests (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  code_norm text generated always as (lower(regexp_replace(code,'\s+','','g'))) stored unique,
  request_date date not null,
  entity text not null, -- الجهة الطالبة
  requester text not null, -- مقدم الطلب
  department text, -- القسم الطالب
  delivery_place text, -- عنوان التسليم
  delivery_date date, -- موعد التسليم
  currency text not null default 'ليرة سورية جديدة',
  status text not null default 'pending'
    check (status in ('pending','executed','on_hold','rejected','cancelled')),
  status_note text,
  notes text,
  signatories jsonb not null default '{}', -- لقطة أسماء التواقيع وقت الإصدار
  pdf_local_path text,
  pdf_storage_path text,
  invoice_storage_path text,
  needs_review boolean not null default false,
  legacy_row int,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. جدول مواد الطلب (request_items)
create table request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  line_no int not null,
  name text not null,
  specs text,
  unit text,
  qty numeric(14,3) not null check (qty > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  line_total numeric(20,2) generated always as (round(qty * unit_price, 2)) stored,
  legacy_total numeric(20,2),
  notes text,
  unique (request_id, line_no)
);

-- 3. جدول القوائم المرجعية (lookups)
create table lookups (
  kind text not null,
  value text not null,
  primary key (kind, value)
); -- entity|requester|department|delivery_place|unit

-- 4. جدول الإعدادات العامة (settings)
create table settings (
  key text primary key,
  value jsonb not null
); -- signatories, archive_dir, currency...

-- 5. جدول سجل التدقيق والمراقبة (audit_log)
create table audit_log (
  id bigserial primary key,
  request_id uuid,
  action text not null,
  old jsonb,
  new jsonb,
  at timestamptz default now(),
  by uuid default auth.uid()
);

-- فهارس تحسين الأداء
create index if not exists idx_requests_request_date on requests(request_date);
create index if not exists idx_requests_status on requests(status);
create index if not exists idx_requests_deleted_at on requests(deleted_at);
create index if not exists idx_request_items_request_id on request_items(request_id);
