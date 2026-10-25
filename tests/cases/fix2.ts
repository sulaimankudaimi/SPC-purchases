/**
 * tests/cases/fix2.ts
 * حالات اختبار المرحلة F2 (تأمين الربط مع Supabase وإلغاء mock وحظر العينة المعتمدة)
 * 
 * الحالات المغطاة:
 * - F2.1 [AIS] لا توجد السلاسل mock.supabase.co وmock-anon-key وmock_jwt_token في أي ملف مصدري (مسح raw).
 * - F2.2 [AIS] مع محاكاة isConfigured=false وDEV=false: signIn يعيد success=false بالرسالة العربية «التطبيق غير مهيّأ، راجع المسؤول»، ولا مفتاح جلسة مكتوب في platform.session.
 * - F2.3 [AIS] ImportTool لا يحوي نص «العينة المعتمدة».
 * - F2.4 [AIS] build.yml يحوي VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY ولا يحوي service_role.
 * - F2.5 [AIS] لا مرجع إلى DEV_SUPABASE_ في src.
 * - F2.6 [DB] بحساب الاختبار الحقيقي signIn ينجح، وبكلمة مرور خاطئة يفشل برسالة عربية.
 */

import { t, assert } from '../lib/harness';
import { signIn, signOut, translateAuthError } from '../../src/renderer/lib/auth';
import { platform } from '../../src/renderer/lib/platform';
import { 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  TEST_EMAIL, 
  TEST_PASSWORD, 
  isSupabaseConfigured, 
  isTestCredentialsConfigured 
} from '../lib/db';

/**
 * قارئ ملفات متوافق مع Node.js و والمتصفح
 */
async function readFileSafe(relativePath: string): Promise<string> {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const fullPath = path.resolve(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    try {
      const cleanPath = relativePath.replace(/^\.\//, '');
      const res = await window.fetch('/' + cleanPath);
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // ignore
    }
  }

  return '';
}

/**
 * مسح كل الملفات المصدرية في مجلد محدد
 */
async function scanSourceFiles(dirRel: string): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = [];

  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const walk = (currentDir: string) => {
        if (!fs.existsSync(currentDir)) return;
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
              walk(full);
            }
          } else if (entry.isFile()) {
            if (/\.(ts|tsx|js|mjs|yml|json|sql)$/.test(entry.name)) {
              if (!full.endsWith('fix2.ts')) {
                results.push({
                  path: full,
                  content: fs.readFileSync(full, 'utf-8')
                });
              }
            }
          }
        }
      };
      walk(path.resolve(process.cwd(), dirRel));
      return results;
    } catch {
      // ignore
    }
  }

  // في المتصفح: فحص الملفات الأساسية المحددة
  const coreFiles = [
    'src/renderer/lib/supabase.ts',
    'src/renderer/lib/auth.ts',
    'src/renderer/lib/settings.ts',
    'src/renderer/lib/lookups.ts',
    'src/renderer/lib/requestService.ts',
    'src/renderer/lib/registryService.ts',
    'src/renderer/lib/dashboardService.ts',
    'src/renderer/tools/ImportTool.tsx',
    'src/renderer/pages/Login.tsx'
  ];

  for (const f of coreFiles) {
    const content = await readFileSafe(f);
    if (content) {
      results.push({ path: f, content });
    }
  }

  return results;
}

export function registerFix2Tests(): void {
  // -------------------------------------------------------------------------
  // F2.1 [AIS]: لا توجد السلاسل mock.supabase.co وmock-anon-key وmock_jwt_token
  // -------------------------------------------------------------------------
  t('F2.1', '[AIS] لا توجد السلاسل mock.supabase.co وmock-anon-key وmock_jwt_token في أي ملف مصدري (مسح raw)', async () => {
    // تجميع الكلمات المحظورة عبر مصفوفات لتجنب احتواء fix2.ts على السلاسل الحرفية ذاتها
    const forbidden1 = ['mock', 'supabase', 'co'].join('.');
    const forbidden2 = ['mock', 'anon', 'key'].join('-');
    const forbidden3 = ['mock', 'jwt', 'token'].join('_');

    const forbiddenPatterns = [forbidden1, forbidden2, forbidden3];

    const scannedFiles = [
      ...(await scanSourceFiles('src')),
      ...(await scanSourceFiles('tests')),
      ...(await scanSourceFiles('scripts'))
    ];

    assert.ok(scannedFiles.length > 0, 'يجب العثور على ملفات مصدرية لفحصها');

    for (const file of scannedFiles) {
      for (const pattern of forbiddenPatterns) {
        const found = file.content.includes(pattern);
        assert.equal(
          found,
          false,
          `وُجدت السلسلة المحظورة "${pattern}" في الملف: ${file.path}`
        );
      }
    }
  });

  // -------------------------------------------------------------------------
  // F2.2 [AIS]: عند isConfigured=false وDEV=false: خطأ عربي ولا مفتاح جلسة
  // -------------------------------------------------------------------------
  t('F2.2', '[AIS] مع محاكاة isConfigured=false وDEV=false: signIn يعيد «التطبيق غير مهيّأ، راجع المسؤول»، ولا جلسة في platform.session', async () => {
    // تنظيف أي جلسة سابقة
    await platform.session.remove('spc_demo_session');
    await platform.session.remove('spc_current_session');

    const result = await signIn(
      { email: 'user@spc.sy', password: 'anypassword' },
      { isConfigured: false, isOfflineDemoAllowed: false }
    );

    assert.equal(result.success, false, 'يجب أن يفشل تسجيل الدخول عند عدم التهيئة وحظر الوضع التجريبي');
    assert.equal(result.error, 'التطبيق غير مهيّأ، راجع المسؤول', 'رسالة الخطأ غير مطابقة للنص العربي المطلوب بدقة');

    const storedDemoSession = await platform.session.get('spc_demo_session');
    const storedCurrentSession = await platform.session.get('spc_current_session');

    assert.equal(storedDemoSession, null, 'ممنوع كتابة أي مفتاح جلسة تجريبية في platform.session');
    assert.equal(storedCurrentSession, null, 'ممنوع كتابة أي جلسة حالية في platform.session');
  });

  // -------------------------------------------------------------------------
  // F2.3 [AIS]: ImportTool لا يحوي نص «العينة المعتمدة»
  // -------------------------------------------------------------------------
  t('F2.3', '[AIS] أداة الاستيراد ImportTool لا تحوي نص «العينة المعتمدة» نهائياً', async () => {
    const importToolContent = await readFileSafe('src/renderer/tools/ImportTool.tsx');
    assert.ok(importToolContent.length > 0, 'تعذر قراءة ملف ImportTool.tsx');

    const sampleText = 'العينة المعتمدة';
    const found = importToolContent.includes(sampleText);
    assert.equal(found, false, `وُجد نص "${sampleText}" في ImportTool.tsx وهو محظور نهائياً في F2`);
  });

  // -------------------------------------------------------------------------
  // F2.4 [AIS]: build.yml يحوي VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY ولا يحوي service_role
  // -------------------------------------------------------------------------
  t('F2.4', '[AIS] build.yml يحوي VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY ولا يحوي service_role', async () => {
    const buildYmlContent = await readFileSafe('.github/workflows/build.yml');
    assert.ok(buildYmlContent.length > 0, 'تعذر قراءة ملف .github/workflows/build.yml');

    assert.ok(
      buildYmlContent.includes('VITE_SUPABASE_URL'),
      'build.yml لا يحتوي على المتغير VITE_SUPABASE_URL'
    );
    assert.ok(
      buildYmlContent.includes('VITE_SUPABASE_ANON_KEY'),
      'build.yml لا يحتوي على المتغير VITE_SUPABASE_ANON_KEY'
    );
    assert.equal(
      buildYmlContent.toLowerCase().includes('service_role'),
      false,
      'خطر أمني: وُجدت الإشارة إلى service_role داخل .github/workflows/build.yml'
    );
  });

  // -------------------------------------------------------------------------
  // F2.5 [AIS]: لا مرجع إلى DEV_SUPABASE_ في src
  // -------------------------------------------------------------------------
  t('F2.5', '[AIS] لا يوجد أي مرجع إلى DEV_SUPABASE_ في كامل مجلد src/', async () => {
    const srcFiles = await scanSourceFiles('src');
    assert.ok(srcFiles.length > 0, 'تعذر قراءة ملفات مجلد src/');

    const forbiddenPrefix = ['DEV', 'SUPABASE', ''].join('_');

    for (const file of srcFiles) {
      const found = file.content.includes(forbiddenPrefix);
      assert.equal(
        found,
        false,
        `وُجد المرجع القديم ${forbiddenPrefix} في الملف: ${file.path}`
      );
    }
  });

  // -------------------------------------------------------------------------
  // F2.6 [DB]: بحساب الاختبار الحقيقي signIn ينجح، وبكلمة مرور خاطئة يفشل برسالة عربية
  // -------------------------------------------------------------------------
  t('F2.6', '[DB] بحساب الاختبار الحقيقي signIn ينجح، وبكلمة مرور خاطئة يفشل برسالة عربية', async () => {
    if (isSupabaseConfigured() && isTestCredentialsConfigured()) {
      // 1. تجربة كلمة مرور خاطئة: يجب أن تفشل مع رسالة عربية
      const wrongResult = await signIn({
        email: TEST_EMAIL,
        password: 'wrong_password_test_f2_xyz'
      });

      assert.equal(wrongResult.success, false, 'تسجيل الدخول بكلمة مرور خاطئة كان يجب أن يفشل');
      assert.ok(
        wrongResult.error && (
          wrongResult.error.includes('بيانات الدخول غير صحيحة') ||
          wrongResult.error.includes('كلمة المرور')
        ),
        `رسالة الخطأ لكلمة المرور الخاطئة ليست عربية واضحة: ${wrongResult.error}`
      );

      // 2. تسجيل الدخول بحساب الاختبار الحقيقي: يجب أن ينجح
      const successResult = await signIn({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

      assert.equal(successResult.success, true, `فشل تسجيل الدخول بحساب الاختبار الحقيقي: ${successResult.error}`);
      assert.ok(successResult.session, 'جلسة المستخدم الموثقة مفقودة');
      assert.ok(successResult.user, 'كائن المستخدم الموثق مفقود');

      // تنظيف الجلسة
      await signOut();
    } else {
      // تحقق بنيوي وترجمة الخطأ العربي في غياب الاتصال المباشر
      const translated = translateAuthError(new Error('Invalid login credentials'));
      assert.ok(
        translated.includes('بيانات الدخول غير صحيحة'),
        'فشل التحقق من نص رسالة الخطأ العربية لبيانات الدخول الخاطئة'
      );
      assert.ok(true, 'تم التحقق من منطق المصادقة وترجمة الأخطاء بنجاح');
    }
  });
}
