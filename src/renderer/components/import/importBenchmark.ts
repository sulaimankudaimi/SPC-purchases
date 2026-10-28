/**
 * src/renderer/components/import/importBenchmark.ts
 * حساب مطابقة الأرقام المرجعية وإعداد تقرير الاستيراد للنسخ
 */

import { ImportResult } from '../../../../scripts/import-core';
import { formatMoney } from '../../../shared/money';
import { extractDateFromCode } from '../../../shared/code';
import { ReferenceCheckItem } from './ImportReferenceMatch';

export interface BenchmarkResult {
  checks: ReferenceCheckItem[];
  allPassed: boolean;
  matchingDatesCount: number;
  dateMismatches: string[];
  itemCountsMap: Record<number, number>;
}

export function computeBenchmarkData(importResult: ImportResult | null): BenchmarkResult | null {
  if (!importResult) return null;
  const r = importResult.report;
  const reqs = importResult.requests;

  const itemCountsMap: Record<number, number> = {};
  let matchingDatesCount = 0;
  const dateMismatches: string[] = [];

  for (const req of reqs) {
    const c = req.items.length;
    itemCountsMap[c] = (itemCountsMap[c] || 0) + 1;

    const codeDate = extractDateFromCode(req.code);
    if (codeDate && codeDate === req.request_date) {
      matchingDatesCount++;
    } else {
      dateMismatches.push(`${req.code}: رمز (${codeDate}) مقابل تاريخ (${req.request_date})`);
    }
  }

  const checks: ReferenceCheckItem[] = [
    { id: 'requests_count', label: 'عدد الطلبات الكلي', expected: '51', actual: String(r.totalRequests), pass: r.totalRequests === 51 },
    { id: 'items_count', label: 'عدد المواد الكلي', expected: '158', actual: String(r.totalItems), pass: r.totalItems === 158 },
    { id: 'calculated_sum', label: 'المجموع الحسابي للمواد Σ(qty × price)', expected: '1,974,220', actual: formatMoney(r.calculatedSum), pass: r.calculatedSum === 1974220 },
    { id: 'legacy_sum', label: 'مجموع القيم المخزنة Σ(legacy_total)', expected: '1,947,220', actual: formatMoney(r.legacyStoredSum), pass: r.legacyStoredSum === 1947220 },
    { id: 'req_pending', label: 'طلبات قيد الانتظار (pending)', expected: '48', actual: String(r.statusDistribution.pending), pass: r.statusDistribution.pending === 48 },
    { id: 'req_executed', label: 'طلبات تم التنفيذ (executed)', expected: '1', actual: String(r.statusDistribution.executed), pass: r.statusDistribution.executed === 1 },
    { id: 'req_on_hold', label: 'طلبات تريث (on_hold)', expected: '1', actual: String(r.statusDistribution.on_hold), pass: r.statusDistribution.on_hold === 1 },
    { id: 'req_rejected', label: 'طلبات مرفوضة (rejected - Q7)', expected: '1', actual: String(r.statusDistribution.rejected), pass: r.statusDistribution.rejected === 1 },
    { id: 'item_pending', label: 'مواد قيد الانتظار (pending)', expected: '155', actual: String(r.itemStatusDistribution.pending), pass: r.itemStatusDistribution.pending === 155 },
    { id: 'item_executed', label: 'مواد تم التنفيذ (executed)', expected: '1', actual: String(r.itemStatusDistribution.executed), pass: r.itemStatusDistribution.executed === 1 },
    { id: 'item_on_hold', label: 'مواد تريث (on_hold)', expected: '1', actual: String(r.itemStatusDistribution.on_hold), pass: r.itemStatusDistribution.on_hold === 1 },
    { id: 'item_rejected', label: 'مواد مرفوضة (rejected)', expected: '1', actual: String(r.itemStatusDistribution.rejected), pass: r.itemStatusDistribution.rejected === 1 },
    { id: 'dist_1', label: 'طلبات بمادة واحدة (1)', expected: '19', actual: String(itemCountsMap[1] || 0), pass: (itemCountsMap[1] || 0) === 19 },
    { id: 'dist_2', label: 'طلبات بمادتين (2)', expected: '11', actual: String(itemCountsMap[2] || 0), pass: (itemCountsMap[2] || 0) === 11 },
    { id: 'dist_3', label: 'طلبات بـ 3 مواد (3)', expected: '6', actual: String(itemCountsMap[3] || 0), pass: (itemCountsMap[3] || 0) === 6 },
    { id: 'dist_4', label: 'طلبات بـ 4 مواد (4)', expected: '1', actual: String(itemCountsMap[4] || 0), pass: (itemCountsMap[4] || 0) === 1 },
    { id: 'dist_5', label: 'طلبات بـ 5 مواد (5)', expected: '2', actual: String(itemCountsMap[5] || 0), pass: (itemCountsMap[5] || 0) === 2 },
    { id: 'dist_6', label: 'طلبات بـ 6 مواد (6)', expected: '4', actual: String(itemCountsMap[6] || 0), pass: (itemCountsMap[6] || 0) === 4 },
    { id: 'dist_7', label: 'طلبات بـ 7 مواد (7)', expected: '5', actual: String(itemCountsMap[7] || 0), pass: (itemCountsMap[7] || 0) === 5 },
    { id: 'dist_8', label: 'طلبات بـ 8 مواد (8)', expected: '1', actual: String(itemCountsMap[8] || 0), pass: (itemCountsMap[8] || 0) === 1 },
    { id: 'dist_9', label: 'طلبات بـ 9 مواد (9)', expected: '2', actual: String(itemCountsMap[9] || 0), pass: (itemCountsMap[9] || 0) === 2 },
    { id: 'date_matching', label: 'تطابق تاريخ الرمز مع تاريخ الطلب (لكل الطلبات)', expected: '51 من 51 (100%)', actual: `${matchingDatesCount} من ${reqs.length}`, pass: matchingDatesCount === 51 && reqs.length === 51 }
  ];

  return {
    checks,
    allPassed: checks.every((c) => c.pass),
    matchingDatesCount,
    dateMismatches,
    itemCountsMap
  };
}

export function buildClipboardReport(importResult: ImportResult, benchmarkData: BenchmarkResult): string {
  const r = importResult.report;
  const lines: string[] = [
    '=== تقرير استيراد سجل الشراء المحلي ومطابقة الثوابت المرجعية ===',
    `تاريخ الفحص: ${new Date().toLocaleString('ar-SY')}`,
    `النتيجة العامة للمطابقة: ${benchmarkData.allPassed ? 'ناجح تماماً PASS (100%)' : 'توجد فروق FAIL'}`,
    '',
    '--- 1. مطابقة الأرقام المرجعية (Reference Benchmarks) ---'
  ];

  for (const c of benchmarkData.checks) {
    lines.push(`- [${c.pass ? 'PASS' : 'FAIL'}] ${c.label}: المتوقع [${c.expected}] | الفعلي [${c.actual}]`);
  }

  lines.push('');
  lines.push('--- 2. القوائم المرجعية المستخرجة من القيم المنظفة (Lookups) ---');
  lines.push(`- الجهات الطالبة (${importResult.lookups.entities.length}): ${importResult.lookups.entities.join(' | ')}`);
  lines.push(`- مقدمو الطلبات (${importResult.lookups.requesters.length}): ${importResult.lookups.requesters.join(' | ')}`);
  lines.push(`- الأقسام (${importResult.lookups.departments.length}): ${importResult.lookups.departments.join(' | ')}`);
  lines.push(`- أماكن التسليم (${importResult.lookups.deliveryPlaces.length}): ${importResult.lookups.deliveryPlaces.join(' | ')}`);
  lines.push(`- الوحدات (${importResult.lookups.units.length}): ${importResult.lookups.units.join(' | ')}`);

  lines.push('');
  const totalSuggestions =
    (r.nameSuggestions?.entities?.length || 0) +
    (r.nameSuggestions?.requesters?.length || 0) +
    (r.nameSuggestions?.departments?.length || 0);
  lines.push(`--- 3. اقتراحات دمج الأسماء المتقاربة (${totalSuggestions}) ---`);
  if (r.nameSuggestions?.entities?.length) {
    for (const s of r.nameSuggestions.entities) {
      lines.push(`- جهة: ${s}`);
    }
  }
  if (r.nameSuggestions?.requesters?.length) {
    for (const s of r.nameSuggestions.requesters) {
      lines.push(`- طالب: ${s}`);
    }
  }
  if (r.nameSuggestions?.departments?.length) {
    for (const s of r.nameSuggestions.departments) {
      lines.push(`- قسم: ${s}`);
    }
  }

  lines.push('');
  lines.push(`--- 4. تعارضات الرموز (${r.conflicts.length}) ---`);
  for (const c of r.conflicts) {
    lines.push(`- ${c}`);
  }

  lines.push('');
  lines.push(`--- 5. الصفوف المرفوضة (${r.rejectedRows.length}) ---`);
  for (const rej of r.rejectedRows) {
    lines.push(`- الصف ${rej.rowNum}: ${rej.reason}`);
  }

  return lines.join('\n');
}
