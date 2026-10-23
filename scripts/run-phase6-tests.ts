/**
 * scripts/run-phase6-tests.ts
 * تشغيل حالات اختبار المرحلة 6 من سطر الأوامر للتحقق الفوري
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerPhase6Tests } from '../tests/cases/phase6';

async function main() {
  console.log('--- بدء تشغيل اختبارات المرحلة 6 (قالب الاستمارة والأرشفة) ---');
  registerPhase6Tests();
  const results = await runAllTests();
  console.log(formatSummary(results));

  const hasFailures = results.some((r) => r.status === 'FAIL');
  if (hasFailures) {
    process.exit(1);
  } else {
    console.log('✅ جميع اختبارات المرحلة 6 اجتازت بنجاح!');
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في مشغل الاختبارات:', err);
  process.exit(1);
});
