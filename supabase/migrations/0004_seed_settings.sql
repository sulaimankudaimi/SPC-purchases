-- supabase/migrations/0004_seed_settings.sql
-- بذور الإعدادات الأولية لمنظومة المشتريات (المرحلة 4)
-- متوافقة مع DATA_MODEL.md و SPEC §1.1 والقرارات D5 و D10 و D11 و D19

-- إدخال الإعدادات الافتراضية
insert into settings (key, value) values
  -- أسماء التواقيع الافتراضية المعتمدة من استمارة طلب الشراء (SPEC §1.1)
  ('signatories', jsonb_build_object(
    'requester', '',                                 -- الطالب (يُعبَّأ تلقائياً عند التفعيل أو يدوياً)
    'warehouse', '',                                 -- المستودع (توقيع يدوي)
    'dept_manager', 'م. ناصر العوده',                 -- مدير الدائرة أو مشرف الحقل
    'supply_manager', 'م. ناصر العوده',               -- مدير دائرة الإمداد والتوريد
    'fields_director', '',                           -- مدير حقول دير الزور (توقيع يدوي)
    'procurement', 'م.م. سامي الفرج'                 -- المشتريات
  )),

  -- مسار مجلد الأرشيف المحلي الافتراضي (D10)
  ('archive_dir', jsonb_build_object(
    'path', 'Documents\ارشيف spc'
  )),

  -- العملة الافتراضية المعتمدة (SPEC §1.1 و D19)
  ('currency', jsonb_build_object(
    'name', 'ليرة سورية جديدة',
    'symbol', 'ل.س'
  )),

  -- مفتاح تعبئة خانة اسم الطالب تلقائياً في التواقيع باسم مقدم الطلب (D11 - مفعّل افتراضياً)
  ('auto_fill_requester', jsonb_build_object(
    'enabled', true
  ))
on conflict (key) do update set value = excluded.value;
