/**
 * src/shared/dates.ts
 * معالجة التواريخ بصيغة DD/MM/YYYY، تحويل الأرقام الهندية/المشرقية، وتحليل التواريخ القديمة (القرار D9 وQ1)
 */

/**
 * تحويل الأرقام المشرقية (الهندية: ٠، ١، ٢، ٣، ٤، ٥، ٦، ٧، ٨، ٩) إلى أرقام لاتينية قياسية (0-9)
 */
export function convertEasternToWesternDigits(str: string): string {
  if (!str) return '';
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = String(str);
  for (let i = 0; i < 10; i++) {
    result = result.split(easternDigits[i]).join(String(i));
  }
  return result;
}

/**
 * فحص عدد الأيام في شهر وسنة محددين للتحقق الصارم من صحة اليوم
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export interface ParsedDateResult {
  iso: string; // YYYY-MM-DD
  formatted: string; // DD/MM/YYYY
  year: number;
  month: number;
  day: number;
  date: Date;
}

/**
 * تحليل تاريخ نصي (بما في ذلك صيغة السجل القديم 19\8\2026 أو 19/8/2026 بصفر بادئ أو بدونه)
 * يرفض التواريخ غير الصالحة ويعيد null
 */
export function parseDate(input: string | Date | null | undefined): ParsedDateResult | null {
  if (!input) return null;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const y = input.getFullYear();
    const m = input.getMonth() + 1;
    const d = input.getDate();
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const formatted = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    return { iso, formatted, year: y, month: m, day: d, date: input };
  }

  // تنظيف النص وتحويل الأرقام المشرقية وإزالة المسافات الزائدة
  const raw = convertEasternToWesternDigits(String(input).trim());
  if (!raw) return null;

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  // 1. فحص صيغة YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    // 2. فحص صيغ D\M\YYYY أو D/M/YYYY أو D-M-YYYY أو D.M.YYYY (مع أو بدون أصفار بادئة)
    const dmyMatch = raw.match(/^(\d{1,2})[\/\\\-\.](\d{1,2})[\/\\\-\.](\d{2}|\d{4})$/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10);
      let rawY = parseInt(dmyMatch[3], 10);
      year = rawY < 100 ? (rawY > 50 ? 1900 + rawY : 2000 + rawY) : rawY;
    }
  }

  if (day === null || month === null || year === null) {
    return null;
  }

  // التحقق الصارم من صحة التاريخ
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return null;

  const dateObj = new Date(year, month - 1, day);
  // التأكد من تطابق المكونات
  if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
    return null;
  }

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

  return {
    iso,
    formatted,
    year,
    month,
    day,
    date: dateObj
  };
}

/**
 * تنسيق التاريخ للعرض بصيغة DD/MM/YYYY (قرار D9)
 */
export function formatDateDDMMYYYY(date: Date | string | null | undefined): string {
  const parsed = parseDate(date);
  return parsed ? parsed.formatted : '';
}

/**
 * تنسيق التاريخ لقاعدة البيانات بصيغة ISO القياسية (YYYY-MM-DD)
 */
export function formatDateISO(date: Date | string | null | undefined): string {
  const parsed = parseDate(date);
  return parsed ? parsed.iso : '';
}
