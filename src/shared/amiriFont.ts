/**
 * src/shared/amiriFont.ts
 * تضمين خط Amiri داخل مستند الـ PDF كـ Data URI (قرار D7 و D16)
 * يعمل في النافذة الخفية للطباعة دون طلب ملفات خارجية
 */

import amiriFontInline from '@fontsource/amiri/files/amiri-arabic-400-normal.woff2?inline';

export const amiriFontDataUri: string =
  typeof amiriFontInline === 'string' ? amiriFontInline : 'data:font/woff2;base64,';
