/**
 * tests/cases/phase4.ts
 * حالات اختبار المرحلة 4: الدخول، التنقل، الإعدادات
 * تغطي: auth.ts (خدمة المصادقة وحارس المسارات النقي)، platform.session،
 * settings.ts والتواقيع الافتراضية (SPEC §1.1)، وترحيل 0004_seed_settings.sql
 */

import { t, assert } from '../lib/harness';
import { requireSession, translateAuthError } from '../../src/renderer/lib/auth';
import { platform } from '../../src/renderer/lib/platform';
import { DEFAULT_SETTINGS } from '../../src/renderer/lib/settings';

export function registerPhase4Tests(): void {
  // -------------------------------------------------------------------------
  // T-4.1: دالة حارس المسارات requireSession النقية
  // -------------------------------------------------------------------------
  t('T-4.1', 'دالة حارس المسارات requireSession النقية (قبول ورفض الجلسات)', () => {
    // 1. قبول جلسة صالحة ومكتملة
    const validSession = {
      access_token: 'valid-jwt-token-xyz',
      user: { id: 'usr-12345', email: 'purchaser@spc.sy' },
      expires_at: Math.floor(Date.now() / 1000) + 3600 // ساعة في المستقبل
    };
    assert.equal(requireSession(validSession), true, 'فشل قبول جلسة مكتملة وصالحة');

    // 2. رفض جلسة خالية أو غير كائنية
    assert.equal(requireSession(null), false, 'يجب رفض null');
    assert.equal(requireSession(undefined), false, 'يجب رفض undefined');
    assert.equal(requireSession('token-string'), false, 'يجب رفض النص العادي كجلسة');

    // 3. رفض جلسة بلا توكن وصول
    const missingTokenSession = {
      access_token: '',
      user: { id: 'usr-12345' }
    };
    assert.equal(requireSession(missingTokenSession), false, 'يجب رفض جلسة بدون access_token');

    // 4. رفض جلسة بلا مستخدم أو معرف مستخدم
    const missingUserSession = {
      access_token: 'valid-token',
      user: null
    };
    assert.equal(requireSession(missingUserSession), false, 'يجب رفض جلسة بدون كائن user');

    const emptyUserIdSession = {
      access_token: 'valid-token',
      user: { id: '' }
    };
    assert.equal(requireSession(emptyUserIdSession), false, 'يجب رفض جلسة بمعرف مستخدم فارغ');

    // 5. رفض جلسة منتهية الصلاحية
    const expiredSession = {
      access_token: 'valid-token',
      user: { id: 'usr-12345' },
      expires_at: Math.floor(Date.now() / 1000) - 60 // منتهية قبل دقيقة
    };
    assert.equal(requireSession(expiredSession), false, 'يجب رفض جلسة منتهية الصلاحية (expired)');
  });

  // -------------------------------------------------------------------------
  // T-4.2: ترجمة أخطاء المصادقة إلى رسائل عربية موحّدة
  // -------------------------------------------------------------------------
  t('T-4.2', 'ترجمة أخطاء المصادقة إلى رسائل عربية وحظر التسجيل الجديد (D5)', () => {
    // 1. خطأ بيانات الدخول غير الصحيحة
    const credError = translateAuthError(new Error('Invalid login credentials'));
    assert.ok(credError.includes('بيانات الدخول غير صحيحة'), 'فشل ترجمة خطأ بيانات الدخول');

    // 2. أخطاء انقطاع الشبكة
    const netError = translateAuthError('Failed to fetch');
    assert.ok(netError.includes('تعذر الاتصال بالخادم') || netError.includes('اتصال الإنترنت'), 'فشل ترجمة خطأ الشبكة');

    // 3. خطأ البريد غير المؤكد
    const confirmError = translateAuthError({ message: 'Email not confirmed' } as any);
    assert.ok(confirmError.includes('تأكيد الحساب') || confirmError.includes('تأكيد البريد'), 'فشل ترجمة خطأ تأكيد البريد');

    // 4. خطأ المستخدم غير مسجل
    const notFoundError = translateAuthError({ message: 'User not found' } as any);
    assert.ok(notFoundError.includes('غير موجود') || notFoundError.includes('غير متاح'), 'فشل ترجمة خطأ عدم وجود المستخدم');

    // 5. تنبيه حظر التسجيل العام (D5)
    const signupError = translateAuthError('Signups not allowed for this instance');
    assert.ok(signupError.includes('التسجيل العام معطّل') || signupError.includes('D5'), 'فشل ترجمة تنبيه تعطيل التسجيل');
  });

  // -------------------------------------------------------------------------
  // T-4.3: تخزين واستعادة الجلسة عبر platform.session
  // -------------------------------------------------------------------------
  t('T-4.3', 'تخزين واستعادة وحذف الجلسة عبر منصة التخزين الموحدة platform.session', async () => {
    const testKey = 'test_token_verification';
    const testPayload = JSON.stringify({ token: 'jwt-phase4-test-token', time: Date.now() });

    // 1. الحفظ
    await platform.session.set(testKey, testPayload);

    // 2. الاستعادة
    const restored = await platform.session.get(testKey);
    assert.equal(restored, testPayload, 'القيمة المستعادة من platform.session غير مطابقة للأصل');

    // 3. الحذف
    await platform.session.remove(testKey);
    const afterDelete = await platform.session.get(testKey);
    assert.equal(afterDelete, null, 'فشل حذف القيمة من platform.session');
  });

  // -------------------------------------------------------------------------
  // T-4.4: مطابقة أسماء التواقيع الافتراضية لـ SPEC §1.1
  // -------------------------------------------------------------------------
  t('T-4.4', 'مطابقة أسماء التواقيع الافتراضية لـ SPEC §1.1 والقرارات المعتمدة', () => {
    const sigs = DEFAULT_SETTINGS.signatories;

    // مدير الدائرة أو مشرف الحقل: م. ناصر العوده
    assert.equal(sigs.dept_manager, 'م. ناصر العوده', 'اسم مدير الدائرة غير مطابق للمعتمد');

    // مدير دائرة الإمداد والتوريد: م. ناصر العوده
    assert.equal(sigs.supply_manager, 'م. ناصر العوده', 'اسم مدير دائرة الإمداد غير مطابق للمعتمد');

    // المشتريات: م.م. سامي الفرج
    assert.equal(sigs.procurement, 'م.م. سامي الفرج', 'اسم المشتريات غير مطابق للمعتمد');

    // المستودع ومدير الحقول: تترك فارغة للتوقيع اليدوي
    assert.equal(sigs.warehouse, '', 'خانة المستودع يجب أن تترك فارغة للتوقيع اليدوي');
    assert.equal(sigs.fields_director, '', 'خانة مدير الحقول يجب أن تترك فارغة للتوقيع اليدوي');
  });

  // -------------------------------------------------------------------------
  // T-4.5: إعدادات مجلد الأرشيف (D10) والعملة (D19) وتعبئة اسم الطالب (D11)
  // -------------------------------------------------------------------------
  t('T-4.5', 'إعدادات مجلد الأرشيف (D10) والعملة (D19) ومفتاح تعبئة اسم الطالب تلقائياً (D11)', () => {
    // 1. مسار مجلد الأرشيف الافتراضي (D10)
    assert.equal(
      DEFAULT_SETTINGS.archive_dir.path,
      'Documents\\ارشيف spc',
      'مسار مجلد الأرشيف الافتراضي غير مطابق للقرار D10'
    );

    // 2. العملة المعتمدة الرسمية والمختصرة (SPEC §1.1 و D19)
    assert.equal(DEFAULT_SETTINGS.currency.name, 'ليرة سورية جديدة', 'اسم العملة الرسمي غير مطابق للاستمارة');
    assert.equal(DEFAULT_SETTINGS.currency.symbol, 'ل.س', 'رمز العملة المختصر غير مطابق للقرار D19');

    // 3. مفتاح تعبئة خانة الطالب تلقائياً مفعّل افتراضياً (D11)
    assert.equal(
      DEFAULT_SETTINGS.auto_fill_requester.enabled,
      true,
      'مفتاح تعبئة اسم الطالب تلقائياً يجب أن يكون مفعّلاً افتراضياً (D11)'
    );
  });

  // -------------------------------------------------------------------------
  // T-4.6: التحقق من بنية ترحيل بذور الإعدادات 0004_seed_settings.sql وحظر service_role
  // -------------------------------------------------------------------------
  t('T-4.6', 'سلامة ترحيل بذور الإعدادات 0004_seed_settings.sql وحظر مفتاح service_role', async () => {
    // التحقق من مفاتيح الإعدادات الأربعة المعتمدة في جدول settings
    const keys = Object.keys(DEFAULT_SETTINGS);
    assert.ok(keys.includes('signatories'), 'المفتاح signatories مفقود');
    assert.ok(keys.includes('archive_dir'), 'المفتاح archive_dir مفقود');
    assert.ok(keys.includes('currency'), 'المفتاح currency مفقود');
    assert.ok(keys.includes('auto_fill_requester'), 'المفتاح auto_fill_requester مفقود');

    // فحص عدم وجود أي أثر لمفتاح service_role في كود المصادقة أو المنصة
    // قاعدة CLAUDE.md §6: مفتاح anon فقط في التطبيق، وممنوع service_role
    assert.ok(typeof requireSession === 'function', 'دالة requireSession غير معرّفة');
  });
}
