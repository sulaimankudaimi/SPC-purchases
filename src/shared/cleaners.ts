/**
 * src/shared/cleaners.ts
 * دوال تنظيف البيانات المحددة بدقة في الخطة (المشاكل Q5 وQ6 من SPEC.md §1.3)
 * قاعدة صارمة: ممنوع أي تحويل غير مذكور صراحة في الخطة.
 */

/**
 * تنظيف القيمة الفارغة (مشكلة Q5):
 * القيمة "_" تعني «لا شيء» وتتحول إلى null حصراً.
 * أي قيمة أخرى تبقى كما هي دون تعديل.
 */
export function cleanEmptyValue<T>(val: T): T | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '_' || trimmed === '') {
      return null;
    }
  }
  return val;
}

/**
 * توحيد الهمزة في وحدة القياس (مشكلة Q6):
 * توحيد «اجور» إلى «أجور» فقط.
 * ممنوع أي تحويل أو تصحيح لأي وحدة أخرى (مثل "خع" أو "ماعون" أو غيرها).
 */
export function cleanUnit(unit: string | null | undefined): string | null {
  if (unit === null || unit === undefined) return null;
  const trimmed = unit.trim();
  if (trimmed === '_' || trimmed === '') return null;

  // توحيد «اجور» أو «أجور» فقط إلى «أجور»
  if (trimmed === 'اجور' || trimmed === 'أجور') {
    return 'أجور';
  }

  // أي وحدة أخرى تُعاد حرفياً كما هي دون لمس
  return unit;
}
