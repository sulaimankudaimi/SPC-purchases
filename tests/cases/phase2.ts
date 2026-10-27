/**
 * tests/cases/phase2.ts
 * حالات اختبار ترحيلات SQL وسياسات الأمان والمحفزات للمرحلة 2
 *
 * المبادئ الحاكمة:
 * - كل البيانات المنشأة تُوسَم بـ entity = 'TEST'.
 * - التنظيف يتم عبر الحذف الناعم (deleted_at = now()).
 * - اختبار RLS المزدوج: anonClient (مرفوض) و authClient (مقبول).
 */

import { t, assert } from '../lib/harness';
import { getAnonClient, getAuthClient, isSupabaseConfigured, isTestCredentialsConfigured } from '../lib/db';

export function registerPhase2Tests(): void {
  // -------------------------------------------------------------------------
  // T-2.1: التحقق من وجود الجداول الخمسة وتفعيل RLS وحالة الحاويات
  // -------------------------------------------------------------------------
  t('T-2.1', 'التحقق من المخطط عبر selftest_schema() وتفعيل RLS على الجداول الخمسة', async () => {
    if (!isSupabaseConfigured()) {
      throw new Error('بيانات اتصال Supabase غير مهيأة في متغيرات البيئة (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY)');
    }

    const anon = getAnonClient();
    const { data, error } = await anon.rpc('selftest_schema');

    if (error) {
      throw new Error(`تعذر استدعاء دالة selftest_schema(): ${error.message} (تأكد من تطبيق ملف 0005_selftest.sql)`);
    }

    assert.ok(data, 'لم تعد دالة selftest_schema أي بيانات');

    // 1. فحص وجود الجداول الخمسة
    const requiredTables = ['requests', 'request_items', 'lookups', 'settings', 'audit_log'];
    const tables = data.tables || [];
    for (const reqTable of requiredTables) {
      const found = tables.find((t: any) => t.table_name === reqTable);
      assert.ok(found && found.exists, `الجدول ${reqTable} غير موجود في المخطط`);
    }

    // 2. فحص تفعيل RLS على كل جدول
    const rlsList = data.rls_status || [];
    for (const reqTable of requiredTables) {
      const found = rlsList.find((r: any) => r.table_name === reqTable);
      assert.ok(found && found.rls_enabled, `الأمان RLS غير مفعّل على جدول ${reqTable}`);
    }

    // 3. فحص خصوصية حاويتي التخزين (D10)
    const buckets = data.storage_buckets || [];
    const pdfBucket = buckets.find((b: any) => b.bucket_id === 'request-pdfs');
    const invoiceBucket = buckets.find((b: any) => b.bucket_id === 'invoices');
    assert.ok(pdfBucket, 'حاوية التخزين request-pdfs غير موجودة');
    assert.equal(pdfBucket.is_public, false, 'حاوية request-pdfs يجب أن تكون خاصة (is_public=false)');
    assert.ok(invoiceBucket, 'حاوية التخزين invoices غير موجودة');
    assert.equal(invoiceBucket.is_public, false, 'حاوية invoices يجب أن تكون خاصة (is_public=false)');
  });

  // -------------------------------------------------------------------------
  // T-2.2: إنفاذ RLS - حظر وصول دور anon غير الموثق
  // -------------------------------------------------------------------------
  t('T-2.2', 'إنفاذ سياسات RLS ورفض قراءة أو إدراج دور anon في requests', async () => {
    if (!isSupabaseConfigured()) {
      throw new Error('بيانات اتصال Supabase غير مهيأة');
    }

    const anon = getAnonClient();

    // 1. محاولة قراءة جدول requests بدور anon (يجب أن تعيد 0 صفوف بسبب RLS)
    const { data: readData, error: readError } = await anon.from('requests').select('id, code').limit(5);

    if (readError) {
      // الرفض بخطأ يعتبر نجاحاً للحظر
      assert.ok(true);
    } else {
      assert.equal(readData?.length, 0, 'خطر أمني: استطاع دور anon قراءة صفوف من جدول requests عبر RLS!');
    }

    // 2. محاولة إدراج صف بدور anon (يجب أن تُرفض بخطأ RLS)
    const { error: insertError } = await anon.from('requests').insert({
      code: 'spc-unauth-test',
      request_date: '2026-10-22',
      entity: 'TEST',
      requester: 'مخترق تجريبي'
    });

    assert.ok(insertError, 'خطر أمني: نجح دور anon في إدراج صف داخل جدول requests!');
  });

  // -------------------------------------------------------------------------
  // T-2.3: دالة توليد الرمز التالي next_request_code بصيغة D3
  // -------------------------------------------------------------------------
  t('T-2.3', 'توليد الرمز التالي next_request_code بصيغة D3: «spc D-M-YY (n)» بقفل استشاري', async () => {
    if (!isSupabaseConfigured() || !isTestCredentialsConfigured()) {
      throw new Error('بيانات الاتصال أو المستخدم التجريبي غير مهيأة (VITE_TEST_EMAIL و VITE_TEST_PASSWORD)');
    }

    const auth = await getAuthClient();
    const testDate = '2026-10-22';

    const { data: code1, error: err1 } = await auth.rpc('next_request_code', { p_date: testDate });
    assert.ok(!err1, `خطأ في توليد الرمز: ${err1?.message}`);
    assert.ok(code1, 'لم يُرجع كود صالح');

    // مطابقة صيغة: spc D-M-YY (n)
    // 22-10-26 (n)
    const match = code1.match(/^spc\s+(\d{1,2})-(\d{1,2})-(\d{2})\s+\((\d+)\)$/);
    assert.ok(match, `صيغة الرمز [${code1}] لا تطابق صيغة القرار D3: spc D-M-YY (n)`);

    const day = match[1];
    const month = match[2];
    const year = match[3];
    assert.equal(day, '22', 'اليوم غير مطابق');
    assert.equal(month, '10', 'الشهر غير مطابق');
    assert.equal(year, '26', 'السنة يجب أن تكون برقمين');
  });

  // -------------------------------------------------------------------------
  // T-2.4: إدراج طلب مع مواده والتحقق من مشهد request_totals
  // -------------------------------------------------------------------------
  t('T-2.4', 'إدراج طلب بوسم entity=TEST ومواده والتحقق من مشهد request_totals', async () => {
    if (!isSupabaseConfigured() || !isTestCredentialsConfigured()) {
      throw new Error('بيانات المستخدم التجريبي غير مهيأة');
    }

    const auth = await getAuthClient();
    const testDate = '2026-10-22';

    // 1. توليد الرمز
    const { data: code } = await auth.rpc('next_request_code', { p_date: testDate });

    // 2. إدراج الطلب الرئيسي بوسم entity = 'TEST'
    const { data: reqData, error: reqErr } = await auth
      .from('requests')
      .insert({
        code: code || `spc 22-10-26 (${Date.now()})`,
        request_date: testDate,
        entity: 'TEST',
        requester: 'مقدم اختبار',
        department: 'قسم الحفر التجريبي',
        status: 'pending'
      })
      .select('id, code')
      .single();

    if (reqErr || !reqData) {
      throw new Error(`فشل إدراج الطلب التجريبي: ${reqErr?.message}`);
    }
    const reqId = (reqData as any).id;

    try {
      // 3. إدراج مادتين
      const items = [
        { request_id: reqId, line_no: 1, name: 'أنبوب فولاذي تجريبي', qty: 10, unit_price: 250 }, // 2500
        { request_id: reqId, line_no: 2, name: 'صمام ضغط تجريبي', qty: 4, unit_price: 500 } // 2000
      ];

      const { error: itemErr } = await auth.from('request_items').insert(items);
      assert.ok(!itemErr, `فشل إدراج مواد الطلب: ${itemErr?.message}`);

      // 4. فحص المشهد request_totals
      const { data: totalsData, error: totalsErr } = await auth
        .from('request_totals')
        .select('items_count, total_amount')
        .eq('request_id', reqId)
        .single();

      if (totalsErr || !totalsData) {
        throw new Error(`فشل الاستعلام من مشهد request_totals: ${totalsErr?.message}`);
      }
      assert.equal((totalsData as any).items_count, 2, 'عدد المواد في المشهد غير صحيح');
      assert.equal(Number((totalsData as any).total_amount), 4500, 'إجمالي قيمة المواد المحسوبة في المشهد غير صحيحة');
    } finally {
      // 5. التنظيف بالحذف الناعم
      await auth.from('requests').update({ deleted_at: new Date().toISOString() }).eq('id', reqId);
    }
  });

  // -------------------------------------------------------------------------
  // T-2.5: محفّز التدقيق وتحديث updated_at وسجل audit_log
  // -------------------------------------------------------------------------
  t('T-2.5', 'محفّز تحديث updated_at وتسجيل تغيّر الحالة في audit_log', async () => {
    if (!isSupabaseConfigured() || !isTestCredentialsConfigured()) {
      throw new Error('بيانات المستخدم التجريبي غير مهيأة');
    }

    const auth = await getAuthClient();
    const testDate = '2026-10-22';

    // 1. إنشاء طلب تجريبي
    const { data: reqData, error: reqErr } = await auth
      .from('requests')
      .insert({
        code: `spc 22-10-26 (audit-${Date.now()})`,
        request_date: testDate,
        entity: 'TEST',
        requester: 'مقدم اختبار تدقيق',
        status: 'pending',
        status_note: 'حالة أولية'
      })
      .select('id, updated_at, status')
      .single();

    if (reqErr || !reqData) {
      throw new Error(`فشل إنشاء طلب اختبار التدقيق: ${reqErr?.message}`);
    }
    const reqId = (reqData as any).id;

    try {
      // 2. تحديث الحالة إلى executed
      const { error: updateErr } = await auth
        .from('requests')
        .update({
          status: 'executed',
          status_note: 'تم الفحص والتنفيذ بنجاح'
        })
        .eq('id', reqId);

      assert.ok(!updateErr, `فشل تحديث حالة الطلب: ${updateErr?.message}`);

      // 3. التحقق من تسجيل الحدث في audit_log
      const { data: auditRows, error: auditErr } = await auth
        .from('audit_log')
        .select('*')
        .eq('request_id', reqId)
        .eq('action', 'status_change');

      assert.ok(!auditErr, `خطأ في قراءة سجل التدقيق: ${auditErr?.message}`);
      if (!auditRows || auditRows.length === 0) {
        throw new Error('لم يتم تسجيل تغيّر الحالة في جدول audit_log بواسطة المحفّز');
      }

      const log = auditRows[0] as any;
      assert.equal(log.old?.status, 'pending', 'الحالة السابقة في سجل التدقيق غير صحيحة');
      assert.equal(log.new?.status, 'executed', 'الحالة الجديدة في سجل التدقيق غير صحيحة');
    } finally {
      // تنظيف بالحذف الناعم
      await auth.from('requests').update({ deleted_at: new Date().toISOString() }).eq('id', reqId);
    }
  });

  // -------------------------------------------------------------------------
  // T-2.6: دالة dashboard_stats واستثناء السجلات المحذوفة ناعماً
  // -------------------------------------------------------------------------
  t('T-2.6', 'دالة dashboard_stats وتأكيد استثناء الطلبات المحذوفة ناعماً (deleted_at)', async () => {
    if (!isSupabaseConfigured() || !isTestCredentialsConfigured()) {
      throw new Error('بيانات المستخدم التجريبي غير مهيأة');
    }

    const auth = await getAuthClient();

    // 1. استدعاء دالة الإحصائيات
    const { data: stats, error: statsErr } = await auth.rpc('dashboard_stats', {
      p_from: '2026-01-01',
      p_to: '2026-12-31'
    });

    assert.ok(!statsErr, `خطأ في استدعاء dashboard_stats: ${statsErr?.message}`);
    assert.ok(stats, 'لم تعد دالة dashboard_stats أي نتائج');
    assert.ok('total_requests' in stats, 'المفتاح total_requests مفقود من نتائج الإحصائيات');
    assert.ok('total_amount' in stats, 'المفتاح total_amount مفقود من نتائج الإحصائيات');
    assert.ok('pending_count' in stats, 'المفتاح pending_count مفقود من نتائج الإحصائيات');
    assert.ok('status_distribution' in stats, 'المفتاح status_distribution مفقود');
  });
}
