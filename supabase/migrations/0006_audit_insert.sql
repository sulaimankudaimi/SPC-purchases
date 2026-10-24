-- supabase/migrations/0006_audit_insert.sql
-- سياسة السماح بالإدراج في سجل التدقيق للمستخدمين الموثقين (audit_log insert policy)
-- تتيح لـ registryService توثيق عمليات التعديل ومراجعة التدقيق مباشرة من العميل الموثَّق
-- مع إبقاء عدم وجود أي سياسات للتعديل (UPDATE) أو الحذف (DELETE) لضمان عدم القابلية للتغيير (Immutability)

create policy "audit_log_insert_auth" on audit_log
  for insert to authenticated
  with check (true);

-- ملاحظة أمنية صارمة:
-- لا توجد سياسة UPDATE أو DELETE لجدول audit_log للمحافظة على أمان وموثوقية السجل التاريخي ومنع التلاعب.
