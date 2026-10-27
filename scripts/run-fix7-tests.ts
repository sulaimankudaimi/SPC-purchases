/**
 * scripts/run-fix7-tests.ts
 * مشغل اختبارات المرحلة F7 عبر CLI (Node.js/tsx)
 */

process.env.VITE_ALLOW_OFFLINE_DEMO = 'true';

import './register-font-hook.cjs';
import '../tests/cases/fix7';
import { runAllTests } from '../tests/lib/harness';

async function main() {
  console.log('=== تشغيل اختبارات المرحلة F7 (معايير الكود، جودة البناء، الخطوط، واستقرار الاختبارات السابقة) ===\n');

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
    console.log('✅ كافة اختبارات المرحلة F7 اجتازت بنجاح!');
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في تشغيل الاختبارات:', err);
  process.exit(1);
});
