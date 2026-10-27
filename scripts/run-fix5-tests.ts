/**
 * scripts/run-fix5-tests.ts
 * مشغل اختبارات المرحلة F5 عبر CLI (Node.js/tsx)
 */

import { registerFix5Tests } from '../tests/cases/fix5';
import { runAllTests, resetRegistry } from '../tests/lib/harness';

async function main() {
  console.log('=== تشغيل اختبارات المرحلة F5 (دالة إحصائيات لوحة التحكم) ===\n');

  resetRegistry();
  registerFix5Tests();

  const results = await runAllTests();
  const failed = results.filter((r) => r.status === 'FAIL');

  console.log(`\nالنتائج: ${results.length - failed.length}/${results.length} ناجحة`);

  if (failed.length > 0) {
    console.error('\nالاختبارات الفاشلة:');
    for (const f of failed) {
      console.error(`- [${f.id}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log('✅ كافة اختبارات المرحلة F5 اجتازت بنجاح!');
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في تشغيل الاختبارات:', err);
  process.exit(1);
});
