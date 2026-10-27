/**
 * src/renderer/lib/auth.ts
 * خدمة المصادقة المركزية فوق Supabase Auth بالبريد وكلمة المرور
 * - رسائل خطأ عربية موحّدة
 * - بلا أي واجهة أو دالة لإنشاء مستخدمين جدد (التسجيل العام معطّل وفق القرار D5)
 * - دالة حارس المسارات requireSession (نقية)
 * - أمان: استخدام مفتاح anon فقط وحظر تام لـ service_role
 * - الوضع التجريبي المحلي محصور فقط بـ DEV === true و VITE_ALLOW_OFFLINE_DEMO === 'true'
 */

import { Session, User, AuthError } from '@supabase/supabase-js';
import {
  supabase,
  isConfigured as defaultIsConfigured,
  isOfflineDemoAllowed as defaultIsOfflineDemoAllowed
} from './supabase';
import { platform } from './platform';

const authListeners = new Set<(session: Session | null) => void>();

function notifyAuthListeners(session: Session | null) {
  authListeners.forEach((cb) => {
    try {
      cb(session);
    } catch (e) {
      console.warn('خطأ في إشعار مستمع المصادقة:', e);
    }
  });
}

/**
 * 1. دالة حارس المسارات (نقية - Pure Function)
 * تتحقق مما إذا كانت الجلسة صالحة وتحتوي على مستخدم وتوكن دخول
 */
export function requireSession(session: unknown): boolean {
  if (!session || typeof session !== 'object') {
    return false;
  }
  const s = session as Record<string, any>;
  if (!s.access_token || typeof s.access_token !== 'string' || s.access_token.trim() === '') {
    return false;
  }
  if (!s.user || typeof s.user !== 'object' || !s.user.id || typeof s.user.id !== 'string') {
    return false;
  }
  // فحص الصلاحية الزمنية إذا كان expires_at متوفراً
  if (typeof s.expires_at === 'number') {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (s.expires_at <= nowInSeconds) {
      return false;
    }
  }
  return true;
}

/**
 * 2. ترجمة أخطاء المصادقة إلى رسائل عربية واضحة ومفهومة
 */
export function translateAuthError(error: AuthError | Error | string | null | undefined): string {
  if (!error) return 'حدث خطأ غير معروف أثناء المصادقة.';

  const message = typeof error === 'string' ? error : error.message || '';
  const lowerMsg = message.toLowerCase();

  if (
    lowerMsg.includes('invalid login credentials') ||
    lowerMsg.includes('invalid_grant') ||
    lowerMsg.includes('bad credentials')
  ) {
    return 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.';
  }

  if (lowerMsg.includes('email not confirmed')) {
    return 'لم يتم تأكيد الحساب بعد. يرجى مراجعة إدارة النظام لتأكيد تفعيل الحساب.';
  }

  if (lowerMsg.includes('user not found')) {
    return 'المستخدم غير موجود في النظام. التسجيل الجديد غير متاح.';
  }

  if (lowerMsg.includes('invalid email') || lowerMsg.includes('valid email')) {
    return 'صيغة البريد الإلكتروني غير صالحة. يرجى كتابة بريد صحيح.';
  }

  if (lowerMsg.includes('password') && (lowerMsg.includes('short') || lowerMsg.includes('least'))) {
    return 'كلمة المرور يجب أن لا تقل عن 6 أحرف.';
  }

  if (
    lowerMsg.includes('network') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('connection')
  ) {
    return 'تعذر الاتصال بالخادم السحابي. يرجى التحقق من اتصال الإنترنت وحالة الشبكة.';
  }

  if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many requests')) {
    return 'تم تجاوز عدد محاولات الدخول المسموح بها. يرجى الانتظار قليلاً ثم إعادة المحاولة.';
  }

  if (lowerMsg.includes('signups not allowed') || lowerMsg.includes('signup disabled')) {
    return 'التسجيل العام معطّل في هذا النظام (القرار D5).';
  }

  return 'فشل تسجيل الدخول: ' + (message || 'خطأ في المصادقة');
}

export interface AuthResult {
  success: boolean;
  session?: Session | null;
  user?: User | null;
  error?: string;
}

export interface SignInOptions {
  isConfigured?: boolean;
  isOfflineDemoAllowed?: boolean;
}

/**
 * 3. تسجيل الدخول بالبريد وكلمة المرور
 */
export async function signIn(
  credentials: { email: string; password: string },
  options?: SignInOptions
): Promise<AuthResult> {
  const email = (credentials.email || '').trim();
  const password = credentials.password || '';

  if (!email) {
    return { success: false, error: 'يرجى إدخال البريد الإلكتروني.' };
  }

  if (!password) {
    return { success: false, error: 'يرجى إدخال كلمة المرور.' };
  }

  const configured = options?.isConfigured !== undefined ? options.isConfigured : defaultIsConfigured;
  const demoAllowed =
    options?.isOfflineDemoAllowed !== undefined ? options.isOfflineDemoAllowed : defaultIsOfflineDemoAllowed;

  // عند عدم تهيئة Supabase
  if (!configured) {
    // القاعدة F2: يُمنع الدخول أو إنشاء أي جلسة إذا لم يُسمح بالوضع التجريبي صراحة
    if (!demoAllowed) {
      return {
        success: false,
        error: 'التطبيق غير مهيّأ، راجع المسؤول'
      };
    }

    // يُسمح به فقط عند DEV === true و VITE_ALLOW_OFFLINE_DEMO === 'true'
    const demoUser: User = {
      id: 'usr_preview_admin',
      app_metadata: {},
      user_metadata: { name: email.split('@')[0] || 'مهندس المشتريات' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: email || 'user@spc.sy'
    } as User;

    const demoSession: Session = {
      access_token: 'spc_demo_session_token_dev_only',
      refresh_token: 'spc_demo_refresh_token',
      expires_in: 86400 * 7,
      expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
      token_type: 'bearer',
      user: demoUser
    };

    await platform.session.set('spc_demo_session', JSON.stringify(demoSession));
    await platform.session.set('spc_last_email', email);
    notifyAuthListeners(demoSession);

    return {
      success: true,
      session: demoSession,
      user: demoUser
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return {
        success: false,
        error: translateAuthError(error)
      };
    }

    if (!data.session || !data.user) {
      return {
        success: false,
        error: 'لم يتم استلام جلسة صالحة من خادم المصادقة.'
      };
    }

    // حفظ نسخة موثقة عبر منصة التخزين
    await platform.session.set('spc_last_email', email);
    notifyAuthListeners(data.session);

    return {
      success: true,
      session: data.session,
      user: data.user
    };
  } catch (err: any) {
    return {
      success: false,
      error: translateAuthError(err)
    };
  }
}

/**
 * 4. تسجيل الخروج وإنهاء الجلسة
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    if (defaultIsConfigured) {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn('تنبيه أثناء تسجيل الخروج من Supabase:', err);
  }

  try {
    // تنظيف مفاتيح الجلسة المحلية عبر platform
    await platform.session.remove('supabase.auth.token');
    await platform.session.remove('spc_current_session');
    await platform.session.remove('spc_demo_session');
    notifyAuthListeners(null);
  } catch (err) {
    // تجاهل خطأ التنظيف
  }

  return { success: true };
}

/**
 * 5. استعادة الجلسة الحالية
 */
export async function getCurrentSession(): Promise<Session | null> {
  if (!defaultIsConfigured) {
    if (!defaultIsOfflineDemoAllowed) {
      return null;
    }
    try {
      const raw = await platform.session.get('spc_demo_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (requireSession(session)) {
          return session;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      return null;
    }
    return requireSession(data.session) ? data.session : null;
  } catch {
    return null;
  }
}

/**
 * 6. الاستماع لتغيرات حالة الجلسة
 */
export function onAuthStateChange(callback: (session: Session | null) => void) {
  authListeners.add(callback);
  let sub: any = null;
  if (defaultIsConfigured) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(requireSession(session) ? session : null);
    });
    sub = data?.subscription;
  }
  return {
    unsubscribe: () => {
      authListeners.delete(callback);
      sub?.unsubscribe?.();
    }
  };
}
