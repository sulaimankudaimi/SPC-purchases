-- ==============================================================================
-- supabase/reset_test_only.sql
-- 
-- تحذير صارم بالأحرف الكبيرة:
-- «ممنوع التشغيل على الإنتاج»
-- «DO NOT RUN IN PRODUCTION - TEST PROJECT RESET ONLY»
-- 
-- هذا الملف مخصص حصرياً لإعادة تعيين بيئة الاختبار والمشروع التجريبي على Supabase.
-- يحذف كافة الجداول والمشاهد والدوال التابعة للمنظومة لإعادة تشغيل الترحيلات من الصفر.
-- ==============================================================================

-- 1. حذف المشاهد
drop view if exists request_totals cascade;

-- 2. حذف الجداول التابعة والمستقلة (CASCADE يتكفل بالمفاتيح الأجنبية والمحفزات)
drop table if exists request_items cascade;
drop table if exists requests cascade;
drop table if exists lookups cascade;
drop table if exists settings cascade;
drop table if exists audit_log cascade;

-- 3. حذف الدوال والمحفزات
drop function if exists next_request_code(date) cascade;
drop function if exists dashboard_stats(date, date) cascade;
drop function if exists handle_updated_at() cascade;
drop function if exists handle_request_status_audit() cascade;
drop function if exists selftest_schema() cascade;
drop function if exists selftest_indexes() cascade;
drop function if exists selftest_audit_policies() cascade;

-- إشعار تأكيد إعادة التعيين
-- ملاحظة: بيانات Buckets في storage.objects لا تُحذف تلقائياً إلا إذا رغب المطور بتفريغها يدوياً.
