/**
 * scripts/run-fix8-tests.ts
 * تشغيل حالات اختبار المرحلة F8 عبر CLI
 */

import { registerFix8Tests } from '../tests/cases/fix8';
import { runAllTests, formatSummary } from '../tests/lib/harness';

async function main() {
  console.log('=== تشغيل حالات اختبار المرحلة F8 (مواءمة التوثيق والقرارات ومصفوفة التتبع) ===\n');
  registerFix8Tests();
  const results = await runAllTests();
  console.log(formatSummary(results));

  const hasFailures = results.some((r) => r.status === 'FAIL');
  if (hasFailures) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('حدث خطأ غير متوقع:', err);
  process.exit(1);
});
