/**
 * scripts/run-phase7-tests.ts
 * تشغيل حالات اختبار المرحلة 7 من سطر الأوامر للتحقق الفوري
 * استيراد بيانات السجل القديم ومطابقة الأرقام الذهبية
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerPhase7Tests } from '../tests/cases/phase7';

async function main() {
  console.log('--- بدء تشغيل اختبارات المرحلة 7 (استيراد السجل القديم والأرقام الذهبية) ---');
  registerPhase7Tests();
  const results = await runAllTests();
  console.log(formatSummary(results));

  const hasFailures = results.some((r) => r.status === 'FAIL');
  if (hasFailures) {
    process.exit(1);
  } else {
    console.log('✅ جميع اختبارات المرحلة 7 اجتازت بنجاح!');
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع في مشغل الاختبارات:', err);
  process.exit(1);
});
