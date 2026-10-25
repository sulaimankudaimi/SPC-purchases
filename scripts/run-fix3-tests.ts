/**
 * scripts/run-fix3-tests.ts
 * تشغيل حالات اختبار المرحلة F3 عبر CLI
 */

import { registerFix3Tests } from '../tests/cases/fix3';
import { runAllTests, formatSummary } from '../tests/lib/harness';

async function main() {
  console.log('=== تشغيل حالات اختبار المرحلة F3 (تكامل Electron وتأمين الحزمة) ===\n');
  registerFix3Tests();
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
