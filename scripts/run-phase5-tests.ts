/**
 * scripts/run-phase5-tests.ts
 * تشغيل حالات اختبار المرحلة 5 من سطر الأوامر للتحقق الفوري
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerPhase5Tests } from '../tests/cases/phase5';

async function main() {
  console.log('--- بدء تشغيل اختبارات المرحلة 5 (شاشة طلب جديد وخدمة الحفظ) ---');
  registerPhase5Tests();
  const results = await runAllTests();
  console.log(formatSummary(results));

  const hasFailures = results.some((r) => r.status === 'FAIL');
  if (hasFailures) {
    process.exit(1);
  } else {
    console.log('✅ جميع اختبارات المرحلة 5 اجتازت بنجاح!');
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في مشغل الاختبارات:', err);
  process.exit(1);
});
