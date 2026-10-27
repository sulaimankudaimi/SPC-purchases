/**
 * src/main/index.ts
 * العملية الرئيسية الحقيقية لتطبيق Electron (منظومة المشتريات)
 * - حصر التشغيل بنسخة واحدة عبر app.requestSingleInstanceLock (النسخة الثانية تُظهر الأولى وتخرج)
 * - app.whenReady ثم إنشاء BrowserWindow بالإعدادات الحالية (حد أدنى 1100×700، إخفاء القائمة)
 * - تحميل الواجهة (dev: ELECTRON_RENDERER_URL أو localhost:3000، prod: loadFile)
 * - setupSecureWindow لمنع النوافذ المنبثقة وحظر will-navigate إلا للعنوان المحلي للتطوير خارج الإنتاج
 * - تطبيق سياسة أمان المحتوى CSP فعلياً عبر session.defaultSession.webRequest.onHeadersReceived
 * - تعطيل DevTools وقائمة التطبيق في الإنتاج
 * - تسجيل قنوات IPC: ping، التخزين الآمن safeStorage في userData، حفظ الملفات، وقناة printToPDF
 */

import path from 'node:path';
import { setupPdfIpcHandler, setupIpcHandlers as registerIpcHandlers } from './ipcHandlers';

export { setupPdfIpcHandler };

// تحميل وحدة electron بأمان في بيئة Electron الحقيقية، مع تفادي الانهيار في بيئات الفحص المجردة
let electron: any = {};
try {
  const { createRequire } = await import('node:module');
  electron = createRequire(import.meta.url)('electron');
} catch {
  // في بيئات الاختبار بدون حزمة electron
}

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const session = electron.session;
const Menu = electron.Menu;
const safeStorage = electron.safeStorage;

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

export const CSP_HEADER =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co;";

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
    nodeIntegration: false
  }
};

let mainWindow: any = null;

/**
 * دالة تهيئة نافذة Electron الآمنة
 */
export function setupSecureWindow(win: any): void {
  if (!win) return;

  // منع فتح نوافذ جديدة
  if (win.webContents?.setWindowOpenHandler) {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }

  // منع التنقل الخارجي إلا للعنوان المحلي للتطوير خارج الإنتاج
  if (win.webContents?.on) {
    win.webContents.on('will-navigate', (event: any, navigationUrl: string) => {
      try {
        const isDev = !app?.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL);
        const parsedUrl = new URL(navigationUrl);
        const isAllowedDev =
          isDev &&
          (parsedUrl.origin === 'http://localhost:3000' ||
            parsedUrl.origin === 'http://127.0.0.1:3000' ||
            parsedUrl.origin === 'http://localhost:5173');
        const isAllowedFile = parsedUrl.protocol === 'file:';

        if (!isAllowedDev && !isAllowedFile) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });
  }
}

export function setupIpcHandlers(): void {
  registerIpcHandlers(ipcMain, app, BrowserWindow, safeStorage);
}

/**
 * إنشاء النافذة الرئيسية
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    ...MAIN_WINDOW_CONFIG,
    webPreferences: {
      ...MAIN_WINDOW_CONFIG.webPreferences,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  setupSecureWindow(mainWindow);

  const isDev = !app?.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL);

  // في بيئة الإنتاج: تعطيل القائمة وتعطيل DevTools
  if (!isDev) {
    if (Menu?.setApplicationMenu) {
      Menu.setApplicationMenu(null);
    }
    mainWindow.webContents?.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // تحميل الواجهة
  if (isDev && (process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL)) {
    const devUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// دورة حياة التطبيق الحقيقية (Single Instance Lock & whenReady)
// ---------------------------------------------------------------------------
if (app && typeof app.requestSingleInstanceLock === 'function') {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    // النسخة الثانية تُنهى فوراً
    app.quit();
  } else {
    app.on('second-instance', () => {
      // إظهار والتركيز على النافذة الأولى
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      // تطبيق CSP فعلياً على ترويسات الاستجابة
      if (session?.defaultSession?.webRequest?.onHeadersReceived) {
        session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': [CSP_HEADER]
            }
          });
        });
      }

      setupIpcHandlers();
      createMainWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createMainWindow();
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
