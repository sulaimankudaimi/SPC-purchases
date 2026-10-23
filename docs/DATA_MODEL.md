# DATA_MODEL.md — نموذج البيانات (القسم 4 من الخطة)

```sql
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
status_note text, notes text,
signatories jsonb not null default '{}', -- لقطة أسماء التواقيع وقت الإصدار
pdf_local_path text, pdf_storage_path text, invoice_storage_path text,
needs_review boolean not null default false, legacy_row int,
created_by uuid default auth.uid(),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
deleted_at timestamptz);

create table request_items (
id uuid primary key default gen_random_uuid(),
request_id uuid not null references requests(id) on delete cascade,
line_no int not null, name text not null, specs text, unit text,
qty numeric(14,3) not null check (qty > 0),
unit_price numeric(18,2) not null check (unit_price >= 0),
line_total numeric(20,2) generated always as (round(qty*unit_price,2)) stored,
legacy_total numeric(20,2), notes text,
unique (request_id, line_no));

create table lookups (kind text, value text, primary key (kind,value)); -- entity\|requester\|department\|delivery_place\|unit
create table settings (key text primary key, value jsonb not null); -- signatories, archive_dir, currency...
create table audit_log (id bigserial primary key, request_id uuid, action text, old jsonb, new jsonb, at timestamptz default now(), by uuid default auth.uid());
```

- دوال/مشاهد: المشهد request_totals (مجموع الطلب وعدد المواد، بـ security_invoker)، الدالة next_request_code(p_date date) (تُرجع الرمز التالي بقفل استشاري)، والدالة dashboard_stats(p_from date, p_to date) (تُرجع JSON للإحصائيات).

- المحفّزات: تحديث updated_at، وتسجيل تغيّر الحالة في audit_log.

- الأمان: تفعيل RLS على كل الجداول بسياسة to authenticated، وحاويتان خاصتان في Storage هما request-pdfs وinvoices بسياسات للموثَّقين فقط. تعطيل التسجيل العام في Auth.
