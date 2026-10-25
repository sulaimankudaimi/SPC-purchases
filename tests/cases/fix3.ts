/**
 * tests/cases/fix3.ts
 * حالات اختبار المرحلة F3 (التكامل مع Electron، تأمين العملية الرئيسية وسياق Preload، وتثبيت الحزم)
 * 
 * الحالات المغطاة:
 * - F3.1 [AIS] package.json يحوي "main": "out/main/index.js" والحزم المحددة مثبتة بلا ^ أو ~.
 * - F3.2 [AIS] src/main/index.ts يحوي requestSingleInstanceLock، onHeadersReceived للـ CSP، setApplicationMenu(null)، وتطبيق أمان will-navigate.
 * - F3.3 [AIS] src/preload/index.ts يعرض window.api بالدوال المحددة فقط ولا يعرض ipcRenderer.
 * - F3.4 [AIS] عدم وجود nodeIntegration: true أو contextIsolation: false في إعدادات BrowserWindow.
 */

import { t, assert } from '../lib/harness';
import { MAIN_WINDOW_CONFIG } from '../../src/main/index';

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

export function registerFix3Tests(): void {
  // -------------------------------------------------------------------------
  // F3.1 [AIS]: package.json يحوي main والحزم مثبتة بلا ^ أو ~
  // -------------------------------------------------------------------------
  t('F3.1', '[AIS] package.json يحوي "main": "out/main/index.js" والحزم المحددة مثبتة بلا ^ أو ~', async () => {
    const pkgRaw = await readFileSafe('package.json');
    assert.ok(pkgRaw.length > 0, 'تعذر قراءة ملف package.json');
    const pkg = JSON.parse(pkgRaw);

    assert.equal(pkg.main, 'out/main/index.js', 'حقل main في package.json يجب أن يكون "out/main/index.js"');

    const requiredPackages = [
      'electron',
      'electron-vite',
      'electron-builder',
      'playwright',
      'vitest',
      'eslint',
      'prettier'
    ];

    for (const pkgName of requiredPackages) {
      const version = (pkg.devDependencies && pkg.devDependencies[pkgName]) ||
                      (pkg.dependencies && pkg.dependencies[pkgName]);

      assert.ok(version, `الحزمة ${pkgName} غير موجودة في dependencies أو devDependencies`);
      assert.equal(
        version.startsWith('^') || version.startsWith('~'),
        false,
        `الحزمة ${pkgName} مثبتة برمز متغير (${version}) والمطلوب إصدار مثبت بدقة بلا ^ أو ~`
      );
    }
  });

  // -------------------------------------------------------------------------
  // F3.2 [AIS]: src/main/index.ts يحوي الآليات الأمنية المطلوبة
  // -------------------------------------------------------------------------
  t('F3.2', '[AIS] src/main/index.ts يحوي requestSingleInstanceLock، onHeadersReceived للـ CSP، setApplicationMenu(null)، وتطبيق will-navigate', async () => {
    const mainContent = await readFileSafe('src/main/index.ts');
    assert.ok(mainContent.length > 0, 'تعذر قراءة ملف src/main/index.ts');

    assert.ok(
      mainContent.includes('requestSingleInstanceLock'),
      'src/main/index.ts يفتقر إلى app.requestSingleInstanceLock'
    );
    assert.ok(
      mainContent.includes('onHeadersReceived'),
      'src/main/index.ts يفتقر إلى تطبيق CSP عبر onHeadersReceived'
    );
    assert.ok(
      mainContent.includes('setApplicationMenu(null)'),
      'src/main/index.ts يفتقر إلى إخفاء شريط القوائم عبر setApplicationMenu(null)'
    );
    assert.ok(
      mainContent.includes('will-navigate'),
      'src/main/index.ts يفتقر إلى حدث will-navigate لتأمين التنقل'
    );
  });

  // -------------------------------------------------------------------------
  // F3.3 [AIS]: src/preload/index.ts يعرض window.api فقط ولا يعرض ipcRenderer
  // -------------------------------------------------------------------------
  t('F3.3', '[AIS] src/preload/index.ts يعرض window.api بالدوال المحددة فقط ولا يعرض ipcRenderer', async () => {
    const preloadContent = await readFileSafe('src/preload/index.ts');
    assert.ok(preloadContent.length > 0, 'تعذر قراءة ملف src/preload/index.ts');

    assert.ok(
      preloadContent.includes("exposeInMainWorld('api'"),
      'src/preload/index.ts لا يعرض api عبر contextBridge.exposeInMainWorld'
    );
    assert.ok(
      preloadContent.includes('ping'),
      'src/preload/index.ts يفتقر إلى دالة ping'
    );
    assert.ok(
      preloadContent.includes('session'),
      'src/preload/index.ts يفتقر إلى كائن session'
    );
    assert.ok(
      preloadContent.includes('printToPdf'),
      'src/preload/index.ts يفتقر إلى دالة printToPdf'
    );
    assert.ok(
      preloadContent.includes('saveFile'),
      'src/preload/index.ts يفتقر إلى دالة saveFile'
    );

    // التحقق من عدم تسريب ipcRenderer
    assert.equal(
      preloadContent.includes("exposeInMainWorld('ipcRenderer'"),
      false,
      'خطر أمني جسيم: تم تسريب ipcRenderer إلى بيئة العرض عبر exposeInMainWorld'
    );
    assert.equal(
      preloadContent.includes("ipcRenderer:"),
      false,
      'خطر أمني: خاصية ipcRenderer معروضة داخل كائن api'
    );
  });

  // -------------------------------------------------------------------------
  // F3.4 [AIS]: عدم وجود nodeIntegration: true أو contextIsolation: false
  // -------------------------------------------------------------------------
  t('F3.4', '[AIS] عدم وجود nodeIntegration: true أو contextIsolation: false في إعدادات BrowserWindow', async () => {
    // 1. فحص الثابت البرمجي MAIN_WINDOW_CONFIG
    assert.equal(MAIN_WINDOW_CONFIG.webPreferences.nodeIntegration, false, 'nodeIntegration يجب أن تكون false تماماً');
    assert.equal(MAIN_WINDOW_CONFIG.webPreferences.contextIsolation, true, 'contextIsolation يجب أن تكون true تماماً');
    assert.ok(MAIN_WINDOW_CONFIG.minWidth >= 1100, 'الحد الأدنى للعرض يجب ألا يقل عن 1100');
    assert.ok(MAIN_WINDOW_CONFIG.minHeight >= 700, 'الحد الأدنى للارتفاع يجب ألا يقل عن 700');

    // 2. فحص نصي لملف src/main/index.ts لضمان عدم وجود أي تهيئة غير آمنة
    const mainContent = await readFileSafe('src/main/index.ts');
    if (mainContent.length > 0) {
      assert.equal(
        /nodeIntegration\s*:\s*true/.test(mainContent),
        false,
        'خطر أمني: وُجد nodeIntegration: true في كود src/main/index.ts'
      );
      assert.equal(
        /contextIsolation\s*:\s*false/.test(mainContent),
        false,
        'خطر أمني: وُجد contextIsolation: false في كود src/main/index.ts'
      );
    }
  });
}
