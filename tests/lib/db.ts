/**
 * tests/lib/db.ts
 * عملاء الاتصال بقاعدة بيانات Supabase لبيئة الاختبارات (Phase 2)
 * يشمل عميلين:
 * 1. anonClient: عميل بمفتاح anon وبلا جلسة موثقة (لفحص RLS وحظر الوصول).
 * 2. authClient: عميل موثَّق بحساب المستخدم التجريبي عبر VITE_TEST_EMAIL/PASSWORD.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// قراءة الإعدادات من متغيرات بيئة Vite
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : ({} as any);

export const SUPABASE_URL: string = 
  env.VITE_SUPABASE_URL || 
  env.DEV_SUPABASE_URL || 
  '';

export const SUPABASE_ANON_KEY: string = 
  env.VITE_SUPABASE_ANON_KEY || 
  env.DEV_SUPABASE_ANON_KEY || 
  '';

export const TEST_EMAIL: string = 
  env.VITE_TEST_EMAIL || 
  env.SUPABASE_TEST_EMAIL || 
  '';

export const TEST_PASSWORD: string = 
  env.VITE_TEST_PASSWORD || 
  env.SUPABASE_TEST_PASSWORD || 
  '';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function isTestCredentialsConfigured(): boolean {
  return Boolean(TEST_EMAIL && TEST_PASSWORD);
}

let cachedAnonClient: SupabaseClient | null = null;
let cachedAuthClient: SupabaseClient | null = null;

/**
 * 1. عميل anon بلا جلسة (فحص رفض الصلاحيات والتحقق من RLS)
 */
export function getAnonClient(): SupabaseClient {
  if (!cachedAnonClient) {
    if (!isSupabaseConfigured()) {
      throw new Error('بيانات اتصال Supabase غير مهيأة في متغيرات البيئة (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY)');
    }
    cachedAnonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
  }
  return cachedAnonClient;
}

/**
 * 2. عميل موثَّق بحساب الاختبار المعتمد
 */
export async function getAuthClient(): Promise<SupabaseClient> {
  if (cachedAuthClient) {
    return cachedAuthClient;
  }

  if (!isSupabaseConfigured()) {
    throw new Error('بيانات اتصال Supabase غير مهيأة في متغيرات البيئة');
  }

  if (!isTestCredentialsConfigured()) {
    throw new Error('بيانات مستخدم الاختبار غير مهيأة (VITE_TEST_EMAIL و VITE_TEST_PASSWORD)');
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (error || !data.session) {
    throw new Error(`فشل تسجيل الدخول بحساب الاختبار: ${error?.message || 'لم يتم استرجاع جلسة'}`);
  }

  cachedAuthClient = client;
  return cachedAuthClient;
}
