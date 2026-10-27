/**
 * src/renderer/lib/supabase.ts
 * عميل Supabase المركزي لتطبيق منظومة المشتريات
 * مزوّد بمحوّل تخزين مخصص يحفظ الجلسة عبر platform.session
 * (safeStorage في Electron و localStorage في المتصفح)
 * الأمان: يستخدم مفتاح anon حصراً، وممنوع استخدام service_role هنا إطلاقاً.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { platform } from './platform';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as any);

export const SUPABASE_URL: string = (env.VITE_SUPABASE_URL || '').trim();
export const SUPABASE_ANON_KEY: string = (env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isConfigured: boolean = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const isOfflineDemoAllowed: boolean = Boolean(
  (env.DEV === true && env.VITE_ALLOW_OFFLINE_DEMO === 'true') ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production')
);

/**
 * محوّل تخزين الجلسات المخصص المربوط بـ platform.session
 */
export const platformStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await platform.session.get(key);
    } catch (err) {
      console.warn('فشل قراءة الجلسة من منصة التخزين:', err);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await platform.session.set(key, value);
    } catch (err) {
      console.warn('فشل كتابة الجلسة في منصة التخزين:', err);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await platform.session.remove(key);
    } catch (err) {
      console.warn('فشل إزالة الجلسة من منصة التخزين:', err);
    }
  }
};

/**
 * عميل Supabase الرئيسي المهيأ مع التخزين الآمن
 * عند عدم التهيئة، نستخدم مساراً بدائياً آمناً لمنع انهيار التهيئة
 */
const fallbackUrl = 'https://spc-unconfigured.local';
const fallbackKey = 'spc-unconfigured-anon-token';

export const supabase: SupabaseClient = createClient(
  isConfigured ? SUPABASE_URL : fallbackUrl,
  isConfigured ? SUPABASE_ANON_KEY : fallbackKey,
  {
    auth: {
      storage: platformStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);
