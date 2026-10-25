/**
 * src/main/index.ts
 * العملية الرئيسية الحقيقية لتطبيق Electron (منظومة المشتريات)
 * - قفل النسخة الواحدة app.requestSingleInstanceLock (D1)
 * - نافذة آمنة بأبعاد دنيا 1100×700 وإخفاء القائمة (D1)
 * - تطبيق CSP فعلياً عبر session.webRequest.onHeadersReceived
 * - حظر DevTools وشريط القوائم في الإنتاج
 * - حظر فتح نوافذ جديدة وحصر will-navigate في المحلي أثناء التطوير فقط
 * - قناة PDF لاستقبال البيانات وحفظ الاستمارة في Documents\ارشيف spc\<الرمز>.pdf (D2, D10)
 * - قنوات SafeStorage لتشفير الجلسة في userData
 */

import * as electronModule from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const electron: any = (electronModule as any).app
  ? electronModule
  : (electronModule as any).default && typeof (electronModule as any).default === 'object'
  ? (electronModule as any).default
  : {};

export const app = electron.app;
export const BrowserWindow = electron.BrowserWindow;
export const ipcMain = electron.ipcMain;
export const session = electron.session;
export const Menu = electron.Menu;
export const safeStorage = electron.safeStorage;

export interface WindowOptions {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  title: string;
  autoHideMenuBar: boolean;
  webPreferences: {
    contextIsolation: boolean;
    sandbox: boolean;
    nodeIntegration: boolean;
    preload?: string;
  };
}

export const CSP_HEADER = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co;";

export const MAIN_WINDOW_CONFIG: WindowOptions = {
  width: 1200,
  height: 800,
  minWidth: 1100,
  minHeight: 700,
  title: 'منظومة المشتريات',
  autoHideMenuBar: true,
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  }
};

let mainWindow: any = null;

/**
 * دالة تهيئة نافذة Electron الآمنة وحمايتها من التنقل والنوافذ المنبثقة
 */
export function setupSecureWindow(targetWindow: any): void {
  if (!targetWindow || !targetWindow.webContents) return;

  // منع فتح نوافذ جديدة
  targetWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // تقييد will-navigate: السماح فقط بالمصدر المحلي للتطوير خارج الإنتاج، وملفات file: في الإنتاج
  targetWindow.webContents.on('will-navigate', (event: any, navigationUrl: string) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const isDev = app ? (!app.isPackaged && process.env.NODE_ENV !== 'production') : true;
      if (isDev && (parsedUrl.origin === 'http://localhost:3000' || parsedUrl.origin === 'http://localhost:5173')) {
        return;
      }
      if (parsedUrl.protocol === 'file:') {
        return;
      }
      event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
}

/**
 * إعداد قنوات SafeStorage لتخزين واسترجاع الجلسة المشفرة في userData
 */
export function setupSessionIpcHandlers(
  targetIpc: any,
  targetApp: any,
  targetSafeStorage: any,
  targetFs: typeof fs,
  targetPath: typeof path
): void {
  if (!targetIpc) return;

  const getStorePath = () => {
    const userDir = targetApp?.getPath ? targetApp.getPath('userData') : (process.env.USERPROFILE || process.env.HOME || '.');
    return targetPath.join(userDir, 'spc_session.enc');
  };

  const readStore = (): Record<string, string> => {
    try {
      const p = getStorePath();
      if (!targetFs.existsSync(p)) return {};
      const raw = targetFs.readFileSync(p);
      if (targetSafeStorage && targetSafeStorage.isEncryptionAvailable && targetSafeStorage.isEncryptionAvailable()) {
        const decrypted = targetSafeStorage.decryptString(raw);
        return JSON.parse(decrypted);
      } else {
        return JSON.parse(raw.toString('utf8'));
      }
    } catch {
      return {};
    }
  };

  const writeStore = (data: Record<string, string>) => {
    try {
      const p = getStorePath();
      const jsonStr = JSON.stringify(data);
      if (targetSafeStorage && targetSafeStorage.isEncryptionAvailable && targetSafeStorage.isEncryptionAvailable()) {
        const encrypted = targetSafeStorage.encryptString(jsonStr);
        targetFs.writeFileSync(p, encrypted);
      } else {
        targetFs.writeFileSync(p, Buffer.from(jsonStr, 'utf8'));
      }
    } catch (err) {
      console.error('Failed to write encrypted session store:', err);
    }
  };

  targetIpc.handle('session:get', async (_event: any, key: string) => {
    const store = readStore();
    return store[key] ?? null;
  });

  targetIpc.handle('session:set', async (_event: any, key: string, value: string) => {
    const store = readStore();
    store[key] = value;
    writeStore(store);
    return true;
  });

  targetIpc.handle('session:remove', async (_event: any, key: string) => {
    const store = readStore();
    delete store[key];
    writeStore(store);
    return true;
  });

  targetIpc.handle('api:ping', async () => 'pong');

  targetIpc.handle('file:save', async (_event: any, payload: { name: string; data: any }) => {
    try {
      const { name, data } = payload;
      const homeDir = targetApp?.getPath ? targetApp.getPath('documents') : (process.env.USERPROFILE || process.env.HOME || '');
      const targetDir = targetPath.join(homeDir, 'ارشيف spc');
      if (!targetFs.existsSync(targetDir)) {
        targetFs.mkdirSync(targetDir, { recursive: true });
      }
      const targetFilePath = targetPath.join(targetDir, name);
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      targetFs.writeFileSync(targetFilePath, buffer);
      return { success: true, path: targetFilePath };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });
}

/**
 * إعداد قناة IPC الموحّدة لتوليد وحفظ PDF عبر نافذة خفية و printToPDF (القرار D2 و D10)
 * القناة: 'spc:print-to-pdf'
 */
export function setupPdfIpcHandler(
  targetIpc: any,
  targetApp: any,
  TargetBrowserWindow: any,
  targetFs: typeof fs,
  targetPath: typeof path
): void {
  if (!targetIpc) return;

  targetIpc.handle('spc:print-to-pdf', async (_event: any, payload: { code: string; html: string; archiveDir?: string }) => {
    const { code, html, archiveDir } = payload;
    if (!code || !html) {
      throw new Error('البيانات غير مكتملة لتوليد PDF.');
    }

    // 1. تحديد مسار الحفظ المحلي الافتراضي: Documents\ارشيف spc\<الرمز>.pdf (D10)
    const homeDir = targetApp?.getPath ? targetApp.getPath('documents') : (process.env.USERPROFILE || process.env.HOME || '');
    const defaultArchiveDir = archiveDir || targetPath.join(homeDir, 'ارشيف spc');
    
    if (targetFs && !targetFs.existsSync(defaultArchiveDir)) {
      targetFs.mkdirSync(defaultArchiveDir, { recursive: true });
    }

    const safeCodeFilename = `${code.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;
    const targetFilePath = targetPath.join(defaultArchiveDir, safeCodeFilename);

    // 2. إنشاء نافذة خفية بالكامل دون عرض (Hidden BrowserWindow)
    const printWindow = new TargetBrowserWindow({
      show: false,
      width: 794,  // A4 pixels at 96 DPI
      height: 1123,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    try {
      // 3. تحميل محتوى HTML المولّد
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // 4. استدعاء printToPDF بمقاس A4 عمودي وهوامش دقيقة (D2)
      const pdfBuffer = await printWindow.webContents.printToPDF({
        pageSize: 'A4',
        landscape: false,
        printBackground: true,
        margins: {
          top: 0.75,
          bottom: 0.75,
          left: 0.25,
          right: 0.25
        }
      });

      // 5. كتابة الملف على القرص
      if (targetFs) {
        targetFs.writeFileSync(targetFilePath, pdfBuffer);
      }

      return {
        success: true,
        filePath: targetFilePath,
        fileName: safeCodeFilename,
        sizeBytes: pdfBuffer.length
      };
    } finally {
      // إغلاق النافذة الخفية فور الانتهاء
      if (!printWindow.isDestroyed()) {
        printWindow.destroy();
      }
    }
  });
}

/**
 * إنشاء النافذة الرئيسية
 */
function createMainWindow(): any {
  if (!BrowserWindow) return null;

  const isProd = app ? (app.isPackaged || process.env.NODE_ENV === 'production') : false;

  // تعطيل شريط القوائم في الإنتاج
  if (isProd && Menu) {
    Menu.setApplicationMenu(null);
  }

  const preloadPath = path.join(__dirname, '../preload/index.mjs');

  const win = new BrowserWindow({
    ...MAIN_WINDOW_CONFIG,
    webPreferences: {
      ...MAIN_WINDOW_CONFIG.webPreferences,
      preload: fs.existsSync(preloadPath) ? preloadPath : path.join(__dirname, '../preload/index.js'),
    }
  });

  setupSecureWindow(win);

  // تعطيل DevTools في الإنتاج
  if (isProd) {
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
  }

  // تحميل الواجهة: URL في التطوير أو ملف محلي في الإنتاج
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// ---------------------------------------------------------------------------
// دورة حياة تطبيق Electron الفعلي (Single Instance Lock و whenReady)
// ---------------------------------------------------------------------------
if (app && app.requestSingleInstanceLock) {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      // تطبيق سياسة CSP فعلياً عبر session.webRequest.onHeadersReceived
      if (session && session.defaultSession) {
        session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': [CSP_HEADER]
            }
          });
        });
      }

      // تسجيل القنوات
      setupSessionIpcHandlers(ipcMain, app, safeStorage, fs, path);
      setupPdfIpcHandler(ipcMain, app, BrowserWindow, fs, path);

      mainWindow = createMainWindow();

      app.on('activate', () => {
        if (BrowserWindow && BrowserWindow.getAllWindows().length === 0) {
          mainWindow = createMainWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }
}
