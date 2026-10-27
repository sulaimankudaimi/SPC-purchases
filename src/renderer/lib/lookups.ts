/**
 * src/renderer/lib/lookups.ts
 * إدارة الاقتراحات والقوائم المرجعية من جدول lookups
 * تدعم: الجهات الطالبة، مقدمو الطلبات، الأقسام، عناوين التسليم، والوحدات
 * تلتزم بـ Q4: اقتراحات دون دمج تلقائي للأسماء المختلفة.
 */

import { supabase, isConfigured, isOfflineDemoAllowed } from './supabase';

export type LookupKind = 'entity' | 'requester' | 'department' | 'delivery_place' | 'unit';

// قيم أولية افتراضية مستخلصة من السجل القديم والاستمارة
export const DEFAULT_LOOKUPS: Record<LookupKind, string[]> = {
  entity: [
    'إدارة الحقول',
    'دائرة الإنتاج',
    'دائرة الصيانة',
    'دائرة الحفر',
    'دائرة الآليات والنقل',
    'دائرة الكهرباء',
    'دائرة الإمداد والتوريد'
  ],
  requester: ['م. ناصر العوده', 'م.م. سامي الفرج', 'م. محمد الحداوي', 'م. سليمان كديمي', 'أحمد العلي'],
  department: ['قسم المشتريات', 'قسم المستودعات', 'قسم الآلات الدقيقة', 'قسم الميكانيك', 'قسم السلامة والأمن الصناعي'],
  delivery_place: [
    'مستودعات دير الزور المركزية',
    'موقع حقل التيم',
    'موقع حقل الورد',
    'موقع حقل الشولا',
    'الإدارة المركزية'
  ],
  unit: ['عدد', 'قطعة', 'زوج', 'متر', 'كغ', 'أجور', 'مجموعة', 'ماعون', 'set', 'خع']
};

/**
 * جلب الاقتراحات لنوع محدد أو لكافة الأنواع
 */
export async function getLookups(kind?: LookupKind): Promise<Record<LookupKind, string[]>> {
  const result: Record<LookupKind, string[]> = {
    entity: [...DEFAULT_LOOKUPS.entity],
    requester: [...DEFAULT_LOOKUPS.requester],
    department: [...DEFAULT_LOOKUPS.department],
    delivery_place: [...DEFAULT_LOOKUPS.delivery_place],
    unit: [...DEFAULT_LOOKUPS.unit]
  };

  if (!isConfigured) {
    if (!isOfflineDemoAllowed) {
      return {
        entity: [],
        requester: [],
        department: [],
        delivery_place: [],
        unit: []
      };
    }
    return result;
  }

  try {
    let query = supabase.from('lookups').select('kind, value');
    if (kind) {
      query = query.eq('kind', kind);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      for (const row of data) {
        const k = row.kind as LookupKind;
        if (result[k] && !result[k].includes(row.value)) {
          result[k].push(row.value);
        }
      }
    }
  } catch (err) {
    console.warn('تعذر تحميل الاقتراحات من الخادم، استخدام الاقتراحات المحلية:', err);
  }

  return result;
}

/**
 * تحديث جدول lookups بقيم جديدة مدخلة دون تكرار ودون دمج تلقائي
 */
export async function saveLookupEntries(entries: Array<{ kind: LookupKind; value: string }>): Promise<void> {
  if (!isConfigured) {
    if (!isOfflineDemoAllowed) {
      console.warn('التطبيق غير مهيّأ للاتصال بقاعدة البيانات');
    }
    return;
  }
  const cleanEntries = entries
    .map((e) => ({ kind: e.kind, value: (e.value || '').trim() }))
    .filter((e) => e.value.length > 0);

  if (cleanEntries.length === 0) return;

  // إزالة التكرار المحلي
  const uniqueMap = new Map<string, { kind: LookupKind; value: string }>();
  for (const item of cleanEntries) {
    uniqueMap.set(`${item.kind}:::${item.value}`, item);
  }
  const toInsert = Array.from(uniqueMap.values());

  try {
    await supabase.from('lookups').upsert(toInsert, { onConflict: 'kind,value' });
  } catch (err) {
    console.warn('تنبيه أثناء حفظ القيم المرجعية في جدول lookups:', err);
  }
}
