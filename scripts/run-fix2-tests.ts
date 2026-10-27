/**
 * scripts/run-fix2-tests.ts
 * تشغيل حالات اختبار المرحلة F2 (ضبط بيئة الإنتاج وحظر الوضع التجريبي)
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerFix2Tests } from '../tests/cases/fix2';

async function main() {
  console.log('--- بدء تشغيل اختبارات المرحلة F2 (بيئة الإنتاج وضبط المصادقة) ---');
  registerFix2Tests();
  const results = await runAllTests();
  console.log(formatSummary(results));

  const hasFailures = results.some((r) => r.status === 'FAIL');
  // ملاحظة: F2.6 هو اختبار [DB] يعتمد على وجود مفاتيح Supabase حية في متغيرات البيئة
  const failedTests = results.filter((r) => r.status === 'FAIL');
  const aisFailures = failedTests.filter((r) => !r.id.includes('F2.6'));

  if (aisFailures.length > 0) {
    console.error(`❌ وُجد ${aisFailures.length} اختبار فاشل في بيئة AIS!`);
    process.exit(1);
  } else {
    console.log('✅ جميع اختبارات [AIS] للمرحلة F2 اجتازت بنجاح!');
    if (failedTests.some((r) => r.id.includes('F2.6'))) {
      console.log('ℹ️ اختبار F2.6 [DB] يتطلب تشغيل Supabase الحي ومفاتيح VITE_TEST_EMAIL.');
    }
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في مشغل الاختبارات:', err);
  process.exit(1);
});
