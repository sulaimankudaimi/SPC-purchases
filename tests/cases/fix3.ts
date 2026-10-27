/**
 * tests/cases/fix3.ts
 * حالات اختبار المرحلة F3: تكامل Electron الكامل (package.json, main, preload, security)
 * تغطي:
 * - F3.1 [AIS]: package.json يحتوي main: out/main/index.js والحزم السبع مثبتة بإصدارات محددة بلا ^ أو ~.
 * - F3.2 [AIS]: main/index.ts يحتوي requestSingleInstanceLock و whenReady و onHeadersReceived.
 * - F3.3 [AIS]: preload يحتوي contextBridge.exposeInMainWorld ولا يُصدّر ipcRenderer نفسه للعميل.
 * - F3.4 [AIS]: حظر وجود nodeIntegration: true في كامل ملفات المنظومة.
 */

import { t, assert } from '../lib/harness';

async function readProjectFile(relPath: string): Promise<string> {
  const cleanPath = relPath.replace(/^\//, '');

  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');
      const fullPath = path.resolve(process.cwd(), cleanPath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
    } catch {
      // fallback
    }
  }

  if (typeof import.meta !== 'undefined' && (import.meta as any).glob) {
    const rawMap = (import.meta as any).glob(
      ['/package.json', '/src/main/index.ts', '/src/preload/index.ts', '/electron.vite.config.ts'],
      { query: '?raw', import: 'default', eager: true }
    );
    const key = '/' + cleanPath;
    if (rawMap[key]) {
      return rawMap[key];
    }
  }

  return '';
}

export function registerFix3Tests(): void {
  // -------------------------------------------------------------------------
  // F3.1 [AIS]: package.json فيه main والحزم السبع مثبتة بلا ^ أو ~
  // -------------------------------------------------------------------------
  t('F3.1', '[AIS] package.json فيه main والحزم السبع مثبتة بإصدارات محددة بلا ^ أو ~', async () => {
    const rawPkg = await readProjectFile('package.json');
    assert.ok(rawPkg.length > 0, 'تعذر قراءة package.json');
    const pkg = JSON.parse(rawPkg);

    // 1. فحص حقل main
    assert.equal(pkg.main, 'out/main/index.js', 'حقل main يجب أن يكون out/main/index.js');

    // 2. فحص السكربتات المطلوبة
    const scripts = pkg.scripts || {};
    assert.ok(scripts.dev, 'سكربت dev مفقود');
    assert.ok(scripts['electron:dev'], 'سكربت electron:dev مفقود');
    assert.ok(scripts['build:web'], 'سكربت build:web مفقود');
    assert.ok(scripts.build, 'سكربت build مفقود');
    assert.ok(scripts.dist, 'سكربت dist مفقود');
    assert.ok(scripts.typecheck, 'سكربت typecheck مفقود');
    assert.ok(scripts.lint, 'سكربت lint مفقود');
    assert.ok(scripts.test, 'سكربت test مفقود');
    assert.ok(scripts.e2e, 'سكربت e2e مفقود');

    // 3. فحص الحزم السبع وتثبيتها بدقة بلا ^ وبلا ~
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
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
      const ver = allDeps[pkgName];
      assert.ok(ver, `الحزمة ${pkgName} مفقودة من package.json`);
      assert.equal(
        ver.startsWith('^') || ver.startsWith('~'),
        false,
        `إصدار الحزمة ${pkgName} (${ver}) يجب أن يكون مثبتاً بدقة دون ^ أو ~`
      );
    }
  });

  // -------------------------------------------------------------------------
  // F3.2 [AIS]: main/index.ts يحوي requestSingleInstanceLock و whenReady و onHeadersReceived
  // -------------------------------------------------------------------------
  t('F3.2', '[AIS] main/index.ts يحوي requestSingleInstanceLock و whenReady و onHeadersReceived', async () => {
    const content = await readProjectFile('src/main/index.ts');
    assert.ok(content.length > 0, 'تعذر قراءة src/main/index.ts');

    assert.ok(
      content.includes('requestSingleInstanceLock'),
      'src/main/index.ts يفتقر إلى app.requestSingleInstanceLock لقفل النسخة الواحدة'
    );
    assert.ok(content.includes('whenReady'), 'src/main/index.ts يفتقر إلى app.whenReady()');
    assert.ok(
      content.includes('onHeadersReceived'),
      'src/main/index.ts يفتقر إلى onHeadersReceived لتطبيق سياسة أمان المحتوى CSP'
    );
  });

  // -------------------------------------------------------------------------
  // F3.3 [AIS]: preload يحوي contextBridge.exposeInMainWorld ولا يحوي ipcRenderer مُصدَّراً
  // -------------------------------------------------------------------------
  t('F3.3', '[AIS] preload يحوي contextBridge.exposeInMainWorld ولا يُعرّض ipcRenderer نفسه', async () => {
    const content = await readProjectFile('src/preload/index.ts');
    assert.ok(content.length > 0, 'تعذر قراءة src/preload/index.ts');

    // التأكد من استدعاء contextBridge.exposeInMainWorld
    assert.ok(
      content.includes('contextBridge.exposeInMainWorld'),
      'src/preload/index.ts يفتقر إلى contextBridge.exposeInMainWorld'
    );

    // التأكد من عدم تصدير ipcRenderer للعميل
    assert.equal(
      content.includes('export const ipcRenderer') ||
        content.includes('export { ipcRenderer') ||
        content.includes('ipcRenderer: ipcRenderer'),
      false,
      'يُحظر تصدير أو كشف كائن ipcRenderer مباشرة إلى واجهة المستخدم'
    );

    // التأكد من توفر الدوال الآمنة المطلوبة
    assert.ok(content.includes('ping:'), 'دالة ping مفقودة في preload');
    assert.ok(content.includes('session:'), 'كائن session مفقود في preload');
    assert.ok(content.includes('printToPdf:'), 'دالة printToPdf مفقودة في preload');
    assert.ok(content.includes('saveFile:'), 'دالة saveFile مفقودة في preload');
  });

  // -------------------------------------------------------------------------
  // F3.4 [AIS]: لا nodeIntegration: true
  // -------------------------------------------------------------------------
  t('F3.4', '[AIS] حظر قاطع لأي تفعيل لـ nodeIntegration: true في كود التطبيق', async () => {
    const mainContent = await readProjectFile('src/main/index.ts');
    assert.equal(
      mainContent.includes('nodeIntegration: true'),
      false,
      'تم العثور على ثغرة أمنية: nodeIntegration: true في src/main/index.ts'
    );

    const configContent = await readProjectFile('electron.vite.config.ts');
    assert.equal(
      configContent.includes('nodeIntegration: true'),
      false,
      'تم العثور على ثغرة أمنية: nodeIntegration: true في electron.vite.config.ts'
    );
  });
}
