/**
 * tests/lib/harness.ts
 * نظام ونواة الاختبارات المدمجة داخل التطبيق (In-app Test Harness)
 */

export interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  durationMs: number;
}

export type TestFn = () => void | Promise<void>;

export interface TestCase {
  id: string;
  name: string;
  fn: TestFn;
}

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

function deepEqualCheck(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqualCheck(a[key], b[key])) return false;
  }
  return true;
}

export const assert = {
  ok(value: any, message?: string): void {
    if (!value) {
      throw new AssertionError(message || `القيمة المتوقعة يجب أن تكون صائبة (truthy) ولكنها كانت: ${String(value)}`);
    }
  },

  equal(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
      throw new AssertionError(
        message || `فشل التطابق: المتوقع [${String(expected)}] بينما الفعلي [${String(actual)}]`
      );
    }
  },

  deepEqual(actual: any, expected: any, message?: string): void {
    if (!deepEqualCheck(actual, expected)) {
      throw new AssertionError(
        message || `فشل التطابق العميق: المتوقع ${JSON.stringify(expected)} بينما الفعلي ${JSON.stringify(actual)}`
      );
    }
  },

  throws(fn: () => any, expected?: any, message?: string): void {
    let threw = false;
    let caughtErr: any;
    try {
      fn();
    } catch (err) {
      threw = true;
      caughtErr = err;
    }
    if (!threw) {
      throw new AssertionError(message || 'كان من المتوقع أن تطلق الدالة استثناء (Error) ولكنها لم تفعل');
    }
    if (expected && typeof expected === 'function' && !(caughtErr instanceof expected)) {
      throw new AssertionError(message || `نوع الخطأ غير مطابق: المتوقع ${expected.name} ووجد ${caughtErr?.name}`);
    }
  },

  async rejects(promiseOrFn: Promise<any> | (() => Promise<any>), expected?: any, message?: string): Promise<void> {
    let rejected = false;
    let caughtErr: any;
    try {
      const p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
      await p;
    } catch (err) {
      rejected = true;
      caughtErr = err;
    }
    if (!rejected) {
      throw new AssertionError(message || 'كان من المتوقع رفض الوعد (Promise rejection) ولكنه اكتمل بنجاح');
    }
    if (expected && typeof expected === 'function' && !(caughtErr instanceof expected)) {
      throw new AssertionError(message || `نوع خطأ الوعد غير مطابق: المتوقع ${expected.name} ووجد ${caughtErr?.name}`);
    }
  }
};

// سجل الحالات المسجلة
const registry: TestCase[] = [];

/**
 * دالة تسجيل حالة اختبار
 * t(id, name, fn)
 */
export function t(id: string, name: string, fn: TestFn): void {
  // تجنب التكرار إذا تم استدعاء التسجيل أكثر من مرة
  const existingIdx = registry.findIndex((item) => item.id === id);
  if (existingIdx >= 0) {
    registry[existingIdx] = { id, name, fn };
  } else {
    registry.push({ id, name, fn });
  }
}

/**
 * جلب جميع الحالات المسجلة
 */
export function getRegisteredCases(): TestCase[] {
  return [...registry];
}

/**
 * إعادة تعيين سجل الحالات المسجلة
 */
export function resetRegistry(): void {
  registry.length = 0;
}

/**
 * تشغيل جميع الاختبارات المسجلة
 */
export async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const testCase of registry) {
    const start = performance.now();
    try {
      await testCase.fn();
      results.push({
        id: testCase.id,
        name: testCase.name,
        status: 'PASS',
        durationMs: Math.round(performance.now() - start)
      });
    } catch (err: any) {
      results.push({
        id: testCase.id,
        name: testCase.name,
        status: 'FAIL',
        error: err?.message || String(err),
        durationMs: Math.round(performance.now() - start)
      });
    }
  }

  return results;
}

/**
 * تنسيق ملخص النتائج كما هو مطلوب حرفياً:
 * «المجموع: X، ناجح: Y، فاشل: Z» ثم سطراً لكل فاشل فقط
 */
export function formatSummary(results: TestResult[]): string {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  const header = `المجموع: ${total}، ناجح: ${passed}، فاشل: ${failed}`;
  const failedLines = results
    .filter((r) => r.status === 'FAIL')
    .map((r) => `- [${r.id}] ${r.name}: ${r.error || 'خطأ غير محدد'}`);

  if (failedLines.length === 0) {
    return header;
  }
  return `${header}\n${failedLines.join('\n')}`;
}
