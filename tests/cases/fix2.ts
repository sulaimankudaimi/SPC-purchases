/**
 * tests/cases/fix2.ts
 * حالات اختبار المرحلة F2: ضبط بيئة الإنتاج وحظر الوضع التجريبي العشوائي
 * تغطي:
 * - F2.1 [AIS]: خلو الملفات المصدرية من سلاسل mock.supabase.co و mock-anon-key و mock_jwt_token.
 * - F2.2 [AIS]: عند محاكاة isConfigured=false و DEV=false: signIn يعيد success=false والرسالة العربية، وبلا جلسة في platform.session.
 * - F2.3 [AIS]: خلو شاشة ImportTool من نص «العينة المعتمدة».
 * - F2.4 [AIS]: build.yml يمرر VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY ويحظر service_role.
 * - F2.5 [AIS]: خلو مجلد src/ من أي إشارة إلى DEV_SUPABASE_.
 * - F2.6 [DB]: بحساب الاختبار الحقيقي signIn ينجح، وبكلمة مرور خاطئة يفشل برسالة عربية.
 */

import { t, assert } from '../lib/harness';
import { signIn } from '../../src/renderer/lib/auth';
import { platform } from '../../src/renderer/lib/platform';
import { isConfigured } from '../../src/renderer/lib/supabase';

// قراءة محتوى الملفات بأمان سواء في Node أو في المتصفح عبر Vite
async function readProjectFile(relPath: string): Promise<string> {
  const cleanPath = relPath.replace(/^\//, '');

  // 1. في بيئة Node.js (عبر tsx أو الاختبارات المباشرة)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');
      const fullPath = path.resolve(process.cwd(), cleanPath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
    } catch {
      // الانتقال للمحاولة التالية
    }
  }

  // 2. في بيئة المتصفح / Vite
  if (typeof import.meta !== 'undefined' && (import.meta as any).glob) {
    const rawMap = (import.meta as any).glob(
      ['/src/**/*.{ts,tsx}', '/.github/workflows/*.yml', '/.env.example'],
      { query: '?raw', import: 'default', eager: true }
    );
    const key = '/' + cleanPath;
    if (rawMap[key]) {
      return rawMap[key];
    }
  }

  return '';
}

async function scanFilesRecursive(dirRelPath: string): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = [];

  if (typeof process !== 'undefined' && process.versions?.node) {
    const fs = await import(/* @vite-ignore */ 'node:fs');
    const path = await import(/* @vite-ignore */ 'node:path');

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name !== 'node_modules' && ent.name !== '.git' && ent.name !== 'dist') {
            walk(full);
          }
        } else if (ent.isFile()) {
          const content = fs.readFileSync(full, 'utf-8');
          results.push({ path: full, content });
        }
      }
    }

    const fullRoot = path.resolve(process.cwd(), dirRelPath.replace(/^\//, ''));
    walk(fullRoot);
    return results;
  }

  // في بيئة المتصفح: استخدام glob
  if (typeof import.meta !== 'undefined' && (import.meta as any).glob) {
    const rawMap = (import.meta as any).glob(
      ['/src/**/*.{ts,tsx}'],
      { query: '?raw', import: 'default', eager: true }
    );
    for (const [p, c] of Object.entries(rawMap)) {
      results.push({ path: p, content: c as string });
    }
  }

  return results;
}

export function registerFix2Tests(): void {
  // -------------------------------------------------------------------------
  // F2.1 [AIS]: لا توجد السلاسل mock.supabase.co و mock-anon-key و mock_jwt_token في أي ملف مصدري
  // -------------------------------------------------------------------------
  t('F2.1', '[AIS] لا توجد السلاسل mock.supabase.co وmock-anon-key وmock_jwt_token في أي ملف مصدري', async () => {
    const forbiddenStrings = ['mock.supabase.co', 'mock-anon-key', 'mock_jwt_token'];
    const files = await scanFilesRecursive('src');

    for (const file of files) {
      for (const forbidden of forbiddenStrings) {
        assert.equal(
          file.content.includes(forbidden),
          false,
          `تم العثور على السلسلة المحظورة "${forbidden}" في الملف ${file.path}`
        );
      }
    }
  });

  // -------------------------------------------------------------------------
  // F2.2 [AIS]: مع محاكاة isConfigured=false و DEV=false: signIn يعيد success=false بالرسالة العربية
  // -------------------------------------------------------------------------
  t('F2.2', '[AIS] مع محاكاة isConfigured=false وDEV=false: signIn يعيد خطأ «التطبيق غير مهيّأ» وبلا جلسة', async () => {
    // محاكاة بيئة إنتاج بدون تهيئة وبدون سماح بالوضع التجريبي
    const res = await signIn(
      { email: 'user@spc.sy', password: 'anypassword123' },
      { isConfigured: false, isOfflineDemoAllowed: false }
    );

    assert.equal(res.success, false, 'signIn يجب أن يفشل عندما لا يكون التطبيق مهيأً ولا مسموحاً بالتجربة');
    assert.equal(
      res.error,
      'التطبيق غير مهيّأ، راجع المسؤول',
      'رسالة الخطأ غير مطابقة للنص العربي المعتمد'
    );

    // التأكد من عدم كتابة أي جلسة في منصة التخزين
    const storedDemo = await platform.session.get('spc_demo_session');
    assert.equal(storedDemo, null, 'يُحظر حفظ أي جلسة تجريبية في platform.session عند رفض الوضع التجريبي');

    const storedCurrent = await platform.session.get('spc_current_session');
    assert.equal(storedCurrent, null, 'يُحظر حفظ أي جلسة في platform.session');
  });

  // -------------------------------------------------------------------------
  // F2.3 [AIS]: ImportTool لا يحوي نص «العينة المعتمدة»
  // -------------------------------------------------------------------------
  t('F2.3', '[AIS] شاشة ImportTool لا تحوي نص «العينة المعتمدة» وتعتمد الملف الحقيقي حصراً', async () => {
    const content = await readProjectFile('src/renderer/tools/ImportTool.tsx');
    assert.ok(content.length > 0, 'تعذر قراءة ملف ImportTool.tsx');
    assert.equal(
      content.includes('العينة المعتمدة'),
      false,
      'تم العثور على خيار «العينة المعتمدة» في ImportTool.tsx وهو محظور'
    );
  });

  // -------------------------------------------------------------------------
  // F2.4 [AIS]: build.yml يحوي VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY ولا يحوي service_role
  // -------------------------------------------------------------------------
  t('F2.4', '[AIS] سير العمل build.yml يحوي VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY ولا يحوي service_role', async () => {
    const content = await readProjectFile('.github/workflows/build.yml');
    assert.ok(content.length > 0, 'تعذر قراءة ملف .github/workflows/build.yml');

    assert.ok(
      content.includes('VITE_SUPABASE_URL'),
      'build.yml لا يمرر متغير VITE_SUPABASE_URL'
    );
    assert.ok(
      content.includes('VITE_SUPABASE_ANON_KEY'),
      'build.yml لا يمرر متغير VITE_SUPABASE_ANON_KEY'
    );
    assert.equal(
      content.toLowerCase().includes('service_role'),
      false,
      'يُحظر تمرير مفتاح service_role في build.yml إطلاقاً'
    );
  });

  // -------------------------------------------------------------------------
  // F2.5 [AIS]: لا مرجع إلى DEV_SUPABASE_ في src
  // -------------------------------------------------------------------------
  t('F2.5', '[AIS] لا يوجد أي مرجع إلى DEV_SUPABASE_ في ملفات مجلد src/', async () => {
    const files = await scanFilesRecursive('src');
    assert.ok(files.length > 0, 'لم يتم العثور على ملفات في src');

    for (const file of files) {
      assert.equal(
        file.content.includes('DEV_SUPABASE_'),
        false,
        `تم العثور على إشارة إلى DEV_SUPABASE_ في الملف ${file.path}`
      );
    }
  });

  // -------------------------------------------------------------------------
  // F2.6 [DB]: بحساب الاختبار الحقيقي signIn ينجح، وبكلمة مرور خاطئة يفشل برسالة عربية
  // -------------------------------------------------------------------------
  t('F2.6', '[DB] بحساب الاختبار الحقيقي signIn ينجح، وبكلمة مرور خاطئة يفشل برسالة عربية', async () => {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (process?.env as any || {});
    const email = env.VITE_TEST_EMAIL || env.SUPABASE_TEST_EMAIL;
    const password = env.VITE_TEST_PASSWORD || env.SUPABASE_TEST_PASSWORD;

    if (!isConfigured || !email || !password) {
      throw new Error('بيانات اتصال Supabase أو حساب الاختبار غير مهيأة في متغيرات البيئة (اختبار [DB])');
    }

    // 1. الدخول بكلمة مرور خاطئة
    const failRes = await signIn({ email, password: 'wrong_password_spc_999' }, { isConfigured: true });
    assert.equal(failRes.success, false, 'يجب أن يفشل الدخول بكلمة مرور خاطئة');
    assert.ok(
      failRes.error && (
        failRes.error.includes('بيانات الدخول غير صحيحة') ||
        failRes.error.includes('فشل تسجيل الدخول')
      ),
      'رسالة الخطأ لكلمة المرور الخاطئة يجب أن تكون عربية واضحة'
    );

    // 2. الدخول بالبيانات الصحيحة
    const successRes = await signIn({ email, password }, { isConfigured: true });
    assert.equal(successRes.success, true, 'يجب أن ينجح الدخول بحساب الاختبار الصحيح');
    assert.ok(successRes.session, 'يجب استلام جلسة صالحة');
    assert.ok(successRes.user, 'يجب استلام كائن المستخدم');
  });
}
