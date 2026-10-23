/**
 * src/renderer/lib/settings.ts
 * إدارة إعدادات المنظومة المخزنة في جدول settings في Supabase
 * متوافقة مع DATA_MODEL.md، و SPEC §1.1، والقرارات D10 و D11 و D19
 */

import { supabase, isConfigured } from './supabase';

export interface SignatoriesSettings {
  requester: string;       // 1. الطالب
  warehouse: string;       // 2. المستودع
  dept_manager: string;    // 3. مدير الدائرة أو مشرف الحقل (م. ناصر العوده)
  supply_manager: string;  // 4. مدير دائرة الإمداد والتوريد (م. ناصر العوده)
  fields_director: string; // 5. مدير حقول دير الزور
  procurement: string;     // 6. المشتريات (م.م. سامي الفرج)
}

export interface ArchiveDirSettings {
  path: string;
}

export interface CurrencySettings {
  name: string;
  symbol: string;
}

export interface AutoFillRequesterSettings {
  enabled: boolean;
}

export interface AppSettings {
  signatories: SignatoriesSettings;
  archive_dir: ArchiveDirSettings;
  currency: CurrencySettings;
  auto_fill_requester: AutoFillRequesterSettings;
}

/**
 * الإعدادات الافتراضية المعتمدة وفق وثائق المشروع والقرارات
 */
export const DEFAULT_SETTINGS: AppSettings = {
  signatories: {
    requester: '',
    warehouse: '',
    dept_manager: 'م. ناصر العوده',
    supply_manager: 'م. ناصر العوده',
    fields_director: '',
    procurement: 'م.م. سامي الفرج'
  },
  archive_dir: {
    path: 'Documents\\ارشيف spc'
  },
  currency: {
    name: 'ليرة سورية جديدة',
    symbol: 'ل.س'
  },
  auto_fill_requester: {
    enabled: true
  }
};

/**
 * جلب جميع الإعدادات من جدول settings في Supabase مع الرجوع للقيم الافتراضية عند التعذر
 */
export async function getSettings(): Promise<AppSettings> {
  if (!isConfigured) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error || !data || data.length === 0) {
      return { ...DEFAULT_SETTINGS };
    }

    const loadedSettings: AppSettings = {
      signatories: { ...DEFAULT_SETTINGS.signatories },
      archive_dir: { ...DEFAULT_SETTINGS.archive_dir },
      currency: { ...DEFAULT_SETTINGS.currency },
      auto_fill_requester: { ...DEFAULT_SETTINGS.auto_fill_requester }
    };

    for (const row of data) {
      if (row.key === 'signatories' && row.value) {
        loadedSettings.signatories = { ...loadedSettings.signatories, ...row.value };
      } else if (row.key === 'archive_dir' && row.value) {
        loadedSettings.archive_dir = { ...loadedSettings.archive_dir, ...row.value };
      } else if (row.key === 'currency' && row.value) {
        loadedSettings.currency = { ...loadedSettings.currency, ...row.value };
      } else if (row.key === 'auto_fill_requester' && row.value) {
        loadedSettings.auto_fill_requester = { ...loadedSettings.auto_fill_requester, ...row.value };
      }
    }

    return loadedSettings;
  } catch (err) {
    console.warn('تعذر تحميل الإعدادات من الخادم، سيتم استخدام القيم الافتراضية:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * حفظ قيمة إعداد محدد في جدول settings
 */
export async function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key,
        value: value as any
      });

    if (error) {
      return { success: false, error: `فشل حفظ الإعداد (${key}): ${error.message}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ غير معروف في حفظ الإعدادات' };
  }
}
