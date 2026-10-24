/**
 * scripts/run-phase9-tests.ts
 * تشغيل اختبارات المرحلة 9 (لوحة التحكم والمؤشرات - dashboardService ودالة dashboard_stats)
 */

import { runAllTests, formatSummary, resetRegistry } from '../tests/lib/harness';
import { registerPhase9Tests } from '../tests/cases/phase9';

async function main() {
  console.log('=== تشغيل اختبارات المرحلة 9: لوحة التحكم والإحصائيات (dashboardService) ===');
  resetRegistry();
  registerPhase9Tests();

  const results = await runAllTests();
  console.log(formatSummary(results));

  const failures = results.filter((r) => r.status === 'FAIL');
  if (failures.length > 0) {
    console.error(`❌ فشل ${failures.length} من أصل ${results.length} اختباراً!`);
    for (const f of failures) {
      console.error(`- [${f.id}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log(`✅ نجحت كافة اختبارات المرحلة 9 (${results.length}/${results.length}) بنسبة 100%!`);
  }
}

main().catch((err) => {
  console.error('خطأ غير متوقع أثناء تشغيل اختبارات المرحلة 9:', err);
  process.exit(1);
});
