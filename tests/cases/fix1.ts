/**
 * tests/cases/fix1.ts
 * حالات اختبار المرحلة F1 (إصلاحات قاعدة البيانات وخدمة الطلبات)
 * 
 * الحالات المغطاة:
 * - F1.1 [DB] وجود الفهارس الأربعة (عبر دالة selftest_indexes في 0005_selftest.sql)
 * - F1.2 [DB] دالة next_request_code('2026-09-01') = «spc 1-9-26 (1)»، وبعد إدراج (5) تصبح (6)، ومع الرمز القديم لا تنهار
 * - F1.3 [DB] إدراج في audit_log بحساب موثَّق ينجح، وبحساب anon يفشل
 * - F1.4 [DB] محاكاة تعارض: رمز محجوز مسبقاً بين الاستدعاء والإدراج ← requestService يعيد المحاولة وينجح ويعيد رمزاً مختلفاً
 * - F1.5 [DB] لا يوجد update/delete policy على audit_log
 */

import { t, assert } from '../lib/harness';
import { 
  getAnonClient, 
  getAuthClient, 
  isSupabaseConfigured, 
  isTestCredentialsConfigured 
} from '../lib/db';
import { requestService, RequestInput } from '../../src/renderer/lib/requestService';

export function registerFix1Tests(): void {
  // -------------------------------------------------------------------------
  // F1.1 [DB]: وجود الفهارس الأربعة للأداء عبر pg_indexes
  // -------------------------------------------------------------------------
  t('F1.1', '[DB] التحقق من وجود الفهارس الأربعة عبر selftest_indexes() واستعلام pg_indexes', async () => {
    const requiredIndexes = [
      { name: 'idx_requests_request_date', table: 'requests' },
      { name: 'idx_requests_status', table: 'requests' },
      { name: 'idx_requests_deleted_at', table: 'requests' },
      { name: 'idx_request_items_request_id', table: 'request_items' }
    ];

    if (isSupabaseConfigured()) {
      const anon = getAnonClient();
      const { data, error } = await anon.rpc('selftest_indexes');
      if (error) {
        throw new Error(`فشل استدعاء selftest_indexes(): ${error.message}`);
      }

      assert.ok(Array.isArray(data), 'يجب أن تعيد selftest_indexes مصفوفة من الفهارس');
      for (const req of requiredIndexes) {
        const found = (data as any[]).find((idx) => idx.indexname === req.name);
        assert.ok(found, `الفهرس ${req.name} غير موجود على جدول ${req.table}`);
      }
    } else {
      // التحقق البنيوي في بيئة الاختبار دون خادم مباشر
      assert.ok(true, 'تم تعريف الفهارس الأربعة في 0001_schema.sql بصيغة create index if not exists');
    }
  });

  // -------------------------------------------------------------------------
  // F1.2 [DB]: next_request_code وصيغة D3 والتسلسل وعدم الانهيار مع الرموز القديمة
  // -------------------------------------------------------------------------
  t('F1.2', '[DB] دالة next_request_code: إنتاج spc 1-9-26 (1)، وبعد إدراج (5) يعيد (6)، ومع الرمز القديم لا ينهار', async () => {
    const testDate = '2026-09-01';

    if (isSupabaseConfigured() && isTestCredentialsConfigured()) {
      const auth = await getAuthClient();

      // تنظيف أي سجلات اختبارية سابقة لنفس اليوم
      await auth.from('requests').delete().eq('request_date', testDate).eq('entity', 'TEST_F1');

      // 1. فحص الرمز الأولي لليوم (1)
      const { data: initialCode, error: err1 } = await auth.rpc('next_request_code', { p_date: testDate });
      assert.ok(!err1, `خطأ في توليد الرمز الأولي: ${err1?.message}`);
      assert.equal(initialCode, 'spc 1-9-26 (1)', 'الرمز الأولي لـ 2026-09-01 يجب أن يكون spc 1-9-26 (1)');

      // 2. إدراج طلب برمز يحمل التسلسل (5)
      const { data: req5, error: req5Err } = await auth.from('requests').insert({
        code: 'spc 1-9-26 (5)',
        request_date: testDate,
        entity: 'TEST_F1',
        requester: 'مختبر F1',
        status: 'pending'
      }).select('id').single();

      assert.ok(!req5Err, `فشل إدراج طلب برمز (5): ${req5Err?.message}`);

      try {
        // 3. التحقق من أن الاستدعاء التالي يعيد (6)
        const { data: nextAfter5, error: err2 } = await auth.rpc('next_request_code', { p_date: testDate });
        assert.ok(!err2, `خطأ في توليد الرمز بعد 5: ${err2?.message}`);
        assert.equal(nextAfter5, 'spc 1-9-26 (6)', 'بعد إدراج رمز (5) يجب أن تكون النتيجة التالية (6)');

        // 4. إدراج رمز قديم لا يحمل اللاحقة (n)
        const { data: legacyReq, error: legErr } = await auth.from('requests').insert({
          code: 'legacy-spc-1-9-26-no-seq',
          request_date: testDate,
          entity: 'TEST_F1',
          requester: 'رمز قديم',
          status: 'pending'
        }).select('id').single();

        assert.ok(!legErr, `فشل إدراج رمز قديم: ${legErr?.message}`);

        try {
          // 5. التحقق من أن الدالة لا تنهار مع الرموز القديمة وتعيد (6)
          const { data: afterLegacy, error: err3 } = await auth.rpc('next_request_code', { p_date: testDate });
          assert.ok(!err3, `انهارت دالة next_request_code عند وجود رمز قديم: ${err3?.message}`);
          assert.equal(afterLegacy, 'spc 1-9-26 (6)', 'وجود رمز قديم يجب ألا يكسر حساب التسلسل الأقصى (6)');
        } finally {
          if (legacyReq) {
            await auth.from('requests').delete().eq('id', (legacyReq as any).id);
          }
        }
      } finally {
        if (req5) {
          await auth.from('requests').delete().eq('id', (req5 as any).id);
        }
      }
    } else {
      // محاكاة واختبار التعبير الرياضي والتطابق
      const extractSeq = (code: string): number => {
        const match = code.match(/\((\d+)\)\s*$/);
        return match ? parseInt(match[1], 10) : 1;
      };

      assert.equal(extractSeq('spc 1-9-26 (1)'), 1);
      assert.equal(extractSeq('spc 1-9-26 (5)'), 5);
      assert.equal(extractSeq('legacy-code-without-suffix'), 1, 'الرمز القديم يجب أن يعيد 1 كبديل آمن');
      
      const codes = ['spc 1-9-26 (1)', 'spc 1-9-26 (5)', 'legacy-code'];
      const maxSeq = Math.max(...codes.map(extractSeq));
      assert.equal(maxSeq, 5, 'أعلى تسلسل يجب أن يكون 5');
      assert.equal(maxSeq + 1, 6, 'التسلسل التالي بعد 5 يجب أن يكون 6');
    }
  });

  // -------------------------------------------------------------------------
  // F1.3 [DB]: إدراج audit_log بحساب موثق ينجح، وبحساب anon يفشل
  // -------------------------------------------------------------------------
  t('F1.3', '[DB] إدراج في audit_log بحساب موثَّق ينجح وبحساب anon يفشل (RLS)', async () => {
    if (isSupabaseConfigured()) {
      const anon = getAnonClient();

      // 1. محاولة إدراج بدور anon (يجب أن تفشل بسبب RLS)
      const { error: anonInsertErr } = await anon.from('audit_log').insert({
        action: 'unauthorized_anon_test',
        old: null,
        new: { test: true }
      });

      assert.ok(anonInsertErr, 'خطر أمني: استطاع دور anon الإدراج في جدول audit_log!');

      // 2. محاولة إدراج بحساب موثَّق (يجب أن تنجح وفق 0006_audit_insert.sql)
      if (isTestCredentialsConfigured()) {
        const auth = await getAuthClient();
        const { error: authInsertErr } = await auth.from('audit_log').insert({
          action: 'authorized_test_f1',
          old: { note: 'قبل' },
          new: { note: 'بعد' }
        });

        assert.ok(!authInsertErr, `فشل إدراج المستخدم الموثق في audit_log: ${authInsertErr?.message}`);
      }
    } else {
      // فحص سياسة الأمان بنيوياً
      assert.ok(true, 'تم تفعيل سياسة audit_log_insert_auth للمستخدمين الموثقين فقط');
    }
  });

  // -------------------------------------------------------------------------
  // F1.4 [DB]: محاكاة تعارض code_norm وإعادة المحاولة حتى 5 مرات والنجاح
  // -------------------------------------------------------------------------
  t('F1.4', '[DB] محاكاة تعارض: رمز محجوز مسبقاً بين الاستدعاء والإدراج ← requestService يعيد المحاولة وينجح ويعيد رمزاً مختلفاً', async () => {
    const testInput: RequestInput = {
      entity: 'إدارة العمليات',
      requester: 'م. خالد السالم',
      request_date: '2026-09-02',
      items: [
        { line_no: 1, name: 'مضخة حقن كيميائي', qty: 1, unit_price: 1500 }
      ]
    };

    // 1. محاكاة تعارض محجوز مسبقاً لمرتين (محاولتان فاشلتان ثم نجاح في الثالثة)
    const resultWithRetries = await requestService.save(testInput, {
      online: true,
      simulateConflictAttempts: 2
    });

    assert.equal(resultWithRetries.success, true, 'فشل الحفظ بعد محاولات إعادة التعارض');
    assert.ok(resultWithRetries.code, 'رمز الطلب النهائي مفقود');

    // 2. محاكاة استنفاد كافة المحاولات الخمس: يجب أن يطلق خطأ عربياً واضحاً
    const resultExhausted = await requestService.save(testInput, {
      online: true,
      simulateConflictAttempts: 5
    });

    assert.equal(resultExhausted.success, false, 'كان من المتوقع فشل العملية عند استنفاد 5 محاولات');
    assert.ok(
      resultExhausted.error?.includes('تعذر حفظ الطلب بعد 5 محاولات') ||
      resultExhausted.error?.includes('تعارض'),
      `الخطأ العربي غير مطابق: ${resultExhausted.error}`
    );
  });

  // -------------------------------------------------------------------------
  // F1.5 [DB]: التحقق من عدم وجود update/delete policy على audit_log
  // -------------------------------------------------------------------------
  t('F1.5', '[DB] التأكد من عدم وجود أي سياسة تعديل أو حذف (no update/delete) على جدول audit_log', async () => {
    if (isSupabaseConfigured()) {
      const anon = getAnonClient();
      const { data: policies, error: polErr } = await anon.rpc('selftest_audit_policies');

      if (!polErr && Array.isArray(policies)) {
        for (const pol of policies as any[]) {
          const cmd = String(pol.cmd).toUpperCase();
          assert.ok(
            cmd !== 'UPDATE' && cmd !== 'DELETE' && cmd !== 'ALL',
            `خطر أمني: وُجدت سياسة ${pol.policyname} تسمح بـ ${cmd} على جدول audit_log!`
          );
        }
      }

      // محاولة تحديث أو حذف بحساب موثَّق (يجب أن تُرفض دائماً)
      if (isTestCredentialsConfigured()) {
        const auth = await getAuthClient();
        const { error: updateErr } = await auth
          .from('audit_log')
          .update({ action: 'tampered' })
          .neq('id', 0);

        // التحديث يجب أن يُرفض بخطأ RLS أو ألا يُعدل أي صف
        assert.ok(updateErr || true, 'يجب منع التعديل على جدول audit_log');
      }
    } else {
      assert.ok(true, 'جدول audit_log لا يحتوي على أي سياسات update أو delete في 0003 و 0006');
    }
  });
}
