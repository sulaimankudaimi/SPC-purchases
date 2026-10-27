/**
 * scripts/run-fix3-tests.ts
 * تشغيل حالات اختبار المرحلة F3 (تكامل Electron والتحقق الأمني)
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerFix3Tests } from '../tests/cases/fix3';

async function main() {
  console.log('--- بدء تشغيل اختبارات المرحلة F3 (تكامل وحزم Electron) ---');
  registerFix3Tests();
  const results = await runAllTests();
  console.log(formatSummary(results));

  const hasFailures = results.some((r) => r.status === 'FAIL');
  if (hasFailures) {
    console.error('❌ وُجدت اختبارات فاشلة في المرحلة F3!');
    process.exit(1);
  } else {
    console.log('✅ جميع اختبارات المرحلة F3 اجتازت بنجاح!');
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في مشغل الاختبارات:', err);
  process.exit(1);
});
