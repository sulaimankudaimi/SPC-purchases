/**
 * src/shared/money.ts
 * معالجة العمليات المالية والحسابية بدقة دون أخطاء الفاصلة العائمة (قواعد الكود §5 والقرار D14 وO4)
 */

import { convertEasternToWesternDigits } from './dates';

/**
 * تقريب المبلغ المالي إلى منزلتين عشريتين بدقة
 */
export function roundMoney(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * ضرب الكمية بالسعر الإفرادي لحساب إجمالي السطر (line_total)
 * الكمية تدعم حتى 3 منازل عشرية، والسعر يدعم منزلتين، والناتج مقرب لمنزلتين
 */
export function multiplyMoney(qty: number, unitPrice: number): number {
  if (isNaN(qty) || isNaN(unitPrice)) return 0;
  // تحويل إلى أعداد صحيحة مقياسية لتفادي أخطاء التمثيل الثنائي العائم
  const qScaled = Math.round(qty * 1000);
  const pScaled = Math.round(unitPrice * 100);
  const product = (qScaled * pScaled) / 1000;
  return Math.round(product) / 100;
}

/**
 * دالة مساعدة لحساب إجمالي السطر (مطابقة لـ multiplyMoney)
 */
export function calculateLineTotal(qty: number, unitPrice: number): number {
  return multiplyMoney(qty, unitPrice);
}

/**
 * جمع مبالغ متعددة دون تراكم أخطاء الفاصلة العائمة
 */
export function addMoney(...amounts: number[]): number {
  let totalCents = 0;
  for (const amt of amounts) {
    if (typeof amt === 'number' && !isNaN(amt)) {
      totalCents += Math.round((amt + Number.EPSILON) * 100);
    }
  }
  return totalCents / 100;
}

/**
 * تنسيق المبلغ المالي للعرض (القرار D14 وO4):
 * بفاصل آلاف، ودون منازل عشرية للأعداد الصحيحة، ومنزلتين عشريتين عند وجود كسور
 */
export function formatMoney(amount: number, withCurrency = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return withCurrency ? '0 ل.س' : '0';
  }
  const isInteger = Math.abs(amount - Math.round(amount)) < 0.001;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: 2
  });

  return withCurrency ? `${formatted} ل.س` : formatted;
}

/**
 * تحليل نص رقمي يحتوي فواصل آلاف أو أرقاماً مشرقية
 * يعيد رقماً دقيقاً أو null إذا كان النص غير صالح
 */
export function parseMoney(text: string | number): number | null {
  if (text === null || text === undefined) return null;
  if (typeof text === 'number') {
    return isNaN(text) ? null : text;
  }

  const cleaned = convertEasternToWesternDigits(String(text).trim())
    .replace(/,/g, '') // إزالة فواصل الآلاف
    .replace(/\s+/g, ''); // إزالة المسافات

  if (!cleaned) return null;

  // التحقق من أن النص عبارة عن رقم موجب أو سالب صالح
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : roundMoney(num);
}
