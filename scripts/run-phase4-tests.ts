/**
 * scripts/run-phase4-tests.ts
 * تشغيل حالات اختبار المرحلة 4 من سطر الأوامر للتحقق الفوري
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerPhase4Tests } from '../tests/cases/phase4';

async function main() {
  console.log('--- بدء تشغيل اختبارات المرحلة 4 (دخول، تنقل، إعدادات) ---');
  registerPhase4Tests();
  const results = await runAllTests();
  console.log(formatSummary(results));

  const hasFailures = results.some((r) => r.status === 'FAIL');
  if (hasFailures) {
    process.exit(1);
  } else {
    console.log('✅ جميع اختبارات المرحلة 4 اجتازت بنجاح!');
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في مشغل الاختبارات:', err);
  process.exit(1);
});
