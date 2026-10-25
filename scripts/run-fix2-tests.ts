/**
 * scripts/run-fix2-tests.ts
 * تشغيل حالات اختبار المرحلة F2 (تأمين الربط مع Supabase وإلغاء mock وحظر العينة المعتمدة)
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerFix2Tests } from '../tests/cases/fix2';

async function main() {
  console.log('--- تشغيل اختبارات المرحلة F2 (fix2) ---');
  registerFix2Tests();

  const results = await runAllTests();
  console.log(formatSummary(results));

  const failures = results.filter((r) => r.status === 'FAIL');
  if (failures.length > 0) {
    console.error(`❌ وُجد ${failures.length} اختبار فاشل!`);
    process.exit(1);
  } else {
    console.log(`✅ كل اختبارات المرحلة F2 (${results.length}/${results.length}) ناجحة بامتياز!`);
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع:', err);
  process.exit(1);
});
