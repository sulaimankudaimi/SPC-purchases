/**
 * scripts/run-phase8-tests.ts
 * تشغيل اختبارات المرحلة 8 (شاشة وخدمات السجل، الحذف الناعم، التصدير، وتوثيق audit_log)
 */

import { runAllTests, formatSummary, resetRegistry } from '../tests/lib/harness';
import { registerPhase8Tests } from '../tests/cases/phase8';

async function main() {
  console.log('=== تشغيل اختبارات المرحلة 8: سجل الشراء المحلي (registryService) ===');
  resetRegistry();
  registerPhase8Tests();

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
    console.log(`✅ نجحت كافة اختبارات المرحلة 8 (${results.length}/${results.length}) بنسبة 100%!`);
  }
}

main().catch((err) => {
  console.error('خطأ غير متوقع أثناء تشغيل اختبارات المرحلة 8:', err);
  process.exit(1);
});
