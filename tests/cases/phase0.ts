/**
 * tests/cases/phase0.ts
 * حالات اختبار المرحلة 0 المدمجة داخل التطبيق
 */

import { t, assert } from '../lib/harness';
import { platform } from '../../src/renderer/lib/platform';

export function registerPhase0Tests(): void {
  t('T-0.1', 'توفر واجهة المنصة الموحدة platform', async () => {
    assert.ok(platform, 'كائن platform غير معرّف');
    assert.equal(typeof platform.ping, 'function', 'دالة platform.ping غير متوفرة');
    assert.ok(platform.session, 'كائن session غير متوفر');
    assert.ok(platform.outbox, 'كائن outbox غير متوفر');
    assert.ok(platform.file, 'كائن file غير متوفر');
  });

  t('T-0.2', 'عمليات صندوق الصادر (outbox enqueue / dequeue)', async () => {
    const testId = `test-outbox-${Date.now()}`;
    await platform.outbox.enqueue({ id: testId, data: 'dummy_order' });
    const queue = await platform.outbox.getQueue();
    const found = queue.find((item) => item.id === testId);
    assert.ok(found, 'العنصر المضاف لم يوجد في صندوق الصادر');
    assert.equal(found.data, 'dummy_order', 'البيانات المخزنة غير متطابقة');

    await platform.outbox.dequeue(testId);
    const queueAfter = await platform.outbox.getQueue();
    const foundAfter = queueAfter.find((item) => item.id === testId);
    assert.equal(foundAfter, undefined, 'فشل حذف العنصر من صندوق الصادر');
  });

  t('T-0.3', 'عمليات الجلسة الآمنة (session get / set / remove)', async () => {
    const key = `test_key_${Date.now()}`;
    const value = 'test_session_secret_value';

    await platform.session.set(key, value);
    const retrieved = await platform.session.get(key);
    assert.equal(retrieved, value, 'القيمة المسترجعة من الجلسة لا تطابق القيمة المحفوظة');

    await platform.session.remove(key);
    const afterRemove = await platform.session.get(key);
    assert.equal(afterRemove, null, 'فشل حذف القيمة من الجلسة');
  });

  t('T-0.4', 'توفر دالة تصدير وحفظ الملفات (platform.file.saveFile)', async () => {
    assert.equal(typeof platform.file.saveFile, 'function', 'دالة saveFile غير معرفة في المنصة');
  });

  t('T-0.5', 'ضمان عدم وجود اتصال مباشر بـ Supabase في المرحلة الحالية (حظر الانحراف X1)', async () => {
    // التأكد من عدم حقن عميل Supabase في سياق التشغيل الحالي
    assert.equal((window as any).__supabase_client__, undefined, 'يجب عدم تشغيل أو ربط Supabase في المرحلة 1');
  });
}
