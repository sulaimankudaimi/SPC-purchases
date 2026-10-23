/**
 * scripts/run-all-phases.ts
 * تشغيل جميع اختبارات المراحل المكتملة (0 إلى 4) للتأكد من عدم وجود أي انحدار
 */

import { runAllTests, formatSummary } from '../tests/lib/harness';
import { registerPhase0Tests } from '../tests/cases/phase0';
import { registerPhase1Tests } from '../tests/cases/phase1';
import { registerPhase2Tests } from '../tests/cases/phase2';
import { registerPhase3Tests } from '../tests/cases/phase3';
import { registerPhase4Tests } from '../tests/cases/phase4';
import { registerPhase5Tests } from '../tests/cases/phase5';
import { registerPhase6Tests } from '../tests/cases/phase6';
import { registerPhase7Tests } from '../tests/cases/phase7';

async function main() {
  console.log('--- تشغيل كافة اختبارات المراحل (0 إلى 7) ---');
  registerPhase0Tests();
  registerPhase1Tests();
  registerPhase2Tests();
  registerPhase3Tests();
  registerPhase4Tests();
  registerPhase5Tests();
  registerPhase6Tests();
  registerPhase7Tests();

  const results = await runAllTests();
  console.log(formatSummary(results));

  const failures = results.filter((r) => r.status === 'FAIL');
  if (failures.length > 0) {
    console.error(`❌ وُجد ${failures.length} اختبار فاشل!`);
    process.exit(1);
  } else {
    console.log(`✅ كل الاختبارات (${results.length}/${results.length}) ناجحة بامتياز!`);
  }
}

main().catch((err) => {
  console.error('فشل غير متوقع:', err);
  process.exit(1);
});
