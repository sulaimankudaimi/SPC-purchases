/**
 * scripts/run-fix6-tests.ts
 * مشغل اختبارات المرحلة F6 عبر CLI (Node.js/tsx)
 */

process.env.VITE_ALLOW_OFFLINE_DEMO = 'true';

import { registerFix6Tests } from '../tests/cases/fix6';
import { runAllTests, resetRegistry } from '../tests/lib/harness';

async function main() {
  console.log('=== تشغيل اختبارات المرحلة F6 (العمل دون اتصال، الصندوق الصادر، النسخ والتعافي) ===\n');

  resetRegistry();
  registerFix6Tests();

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
    console.log('✅ كافة اختبارات المرحلة F6 اجتازت بنجاح!');
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في تشغيل الاختبارات:', err);
  process.exit(1);
});
