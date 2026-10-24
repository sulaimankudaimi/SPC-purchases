/**
 * scripts/run-fix1-tests.ts
 * تشغيل حالات اختبار المرحلة F1 (إصلاحات قاعدة البيانات وخدمة الطلبات)
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerFix1Tests } from '../tests/cases/fix1';

async function main() {
  console.log('--- تشغيل اختبارات المرحلة F1 (fix1) ---');
  registerFix1Tests();

  const results = await runAllTests();
  console.log(formatSummary(results));

  const failures = results.filter((r) => r.status === 'FAIL');
  if (failures.length > 0) {
    console.error(`❌ وُجد ${failures.length} اختبار فاشل!`);
    process.exit(1);
  } else {
    console.log(`✅ كل اختبارات المرحلة F1 (${results.length}/${results.length}) ناجحة بامتياز!`);
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع:', err);
  process.exit(1);
});
