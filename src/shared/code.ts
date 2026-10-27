/**
 * src/shared/code.ts
 * دوال تطبيع وتحليل رموز طلبات الشراء: spc D-M-YY (n) (القرار D3 وQ2)
 * تنبيه: لا يتم توليد الرموز هنا، فالتوليد يتم حصراً في قاعدة البيانات (قرار D3).
 */

import { convertEasternToWesternDigits } from './dates';

export interface ParsedCode {
  raw: string;
  prefix: string;
  day: number;
  month: number;
  year: number;
  fullYear: number;
  seq: number;
}

/**
 * دالة تطبيع رمز الطلب بحروف صغيرة وحذف كافة المسافات والفراغات
 * مطابقة تماماً لتعبير قاعدة البيانات: lower(regexp_replace(code, '\s+', '', 'g'))
 */
export function normalizeCode(code: string): string {
  if (!code) return '';
  const converted = convertEasternToWesternDigits(String(code));
  return converted.toLowerCase().replace(/\s+/g, '');
}

/**
 * تحليل رمز الطلب بصيغة القرار D3: «spc D-M-YY (n)»
 * يدعم التنسيق القياسي والرموز القديمة (مثل مسافات متفاوتة أو غياب اللاحقة)
 * ويعيد الأجزاء المفككة أو null إذا تعذر التحليل
 */
export function parseCode(code: string): ParsedCode | null {
  if (!code || typeof code !== 'string') return null;

  const normalized = normalizeCode(code);

  // التعبير النمطي للرمز بعد التطبيع:
  // يبدأ بـ spc (أو sps من الأخطاء القديمة Q2)، متبوعاً باليوم (1-31)، ثم الشهر (1-12)، ثم السنة برقمين أو أربعة، ثم لاحقة (n)
  const match = normalized.match(/^(spc|sps)(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})(?:\((\d+)\))?$/);
  if (!match) return null;

  const prefix = match[1];
  const day = parseInt(match[2], 10);
  const month = parseInt(match[3], 10);
  let rawYear = parseInt(match[4], 10);
  const seq = match[5] ? parseInt(match[5], 10) : 1;

  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;

  let year = rawYear;
  let fullYear = rawYear;
  if (rawYear < 100) {
    year = rawYear;
    fullYear = 2000 + rawYear;
  } else {
    year = rawYear % 100;
    fullYear = rawYear;
  }

  return {
    raw: code,
    prefix,
    day,
    month,
    year,
    fullYear,
    seq
  };
}

/**
 * فحص ما إذا كان الرمز يطابق الصيغة القياسية للقرار D3 بدقة:
 * spc D-M-YY (n)
 */
export function isValidStandardCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  // صيغة قياسية: spc ثم مسافة ثم يوم (1-2 رقم) ثم شرطة ثم شهر (1-2 رقم) ثم شرطة ثم سنة (رقمين) ثم مسافة ثم (رقم)
  return /^spc\s+\d{1,2}-\d{1,2}-\d{2}\s+\(\d+\)$/i.test(code.trim());
}

/**
 * استخراج التاريخ بصيغة ISO (YYYY-MM-DD) من رمز الطلب (spc D-M-YY (n))
 */
export function extractDateFromCode(code: string): string | null {
  const p = parseCode(code);
  if (!p) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.fullYear}-${pad(p.month)}-${pad(p.day)}`;
}
