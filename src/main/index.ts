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

import fs from 'node:fs';
import path from 'node:path';

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
        const isAllowedDev = isDev && (
          parsedUrl.origin === 'http://localhost:3000' ||
          parsedUrl.origin === 'http://127.0.0.1:3000' ||
          parsedUrl.origin === 'http://localhost:5173'
        );
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

/**
 * إعداد قناة IPC الموحّدة لتوليد وحفظ PDF عبر نافذة خفية و printToPDF (القرار D2 و D10)
 */
export function setupPdfIpcHandler(ipc: any, electronApp: any, WindowClass: any, fileSystem: any, pathModule: any): void {
  if (!ipc) return;

  ipc.handle('spc:print-to-pdf', async (_event: any, payload: { code: string; html: string; archiveDir?: string }) => {
    const { code, html, archiveDir } = payload;
    if (!code || !html) {
      throw new Error('البيانات غير مكتملة لتوليد PDF.');
    }

    const homeDir = electronApp ? electronApp.getPath('documents') : (process.env.USERPROFILE || process.env.HOME || '');
    const defaultArchiveDir = archiveDir || pathModule.join(homeDir, 'ارشيف spc');
    
    if (fileSystem && !fileSystem.existsSync(defaultArchiveDir)) {
      fileSystem.mkdirSync(defaultArchiveDir, { recursive: true });
    }

    const safeCodeFilename = `${code.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;
    const targetFilePath = pathModule.join(defaultArchiveDir, safeCodeFilename);

    const printWindow = new WindowClass({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

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

      if (fileSystem) {
        fileSystem.writeFileSync(targetFilePath, pdfBuffer);
      }

      return {
        success: true,
        filePath: targetFilePath,
        fileName: safeCodeFilename,
        sizeBytes: pdfBuffer.length
      };
    } finally {
      if (!printWindow.isDestroyed()) {
        printWindow.destroy();
      }
    }
  });
}

/**
 * إعداد مخزن الجلسات الآمن في userData باستخدام safeStorage
 */
function getSessionStorePath(): string {
  const userDir = app?.getPath ? app.getPath('userData') : process.cwd();
  return path.join(userDir, 'spc_session_store.json');
}

function readSessionStore(): Record<string, string> {
  try {
    const storePath = getSessionStorePath();
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // تجاهل
  }
  return {};
}

function writeSessionStore(data: Record<string, string>): void {
  try {
    const storePath = getSessionStorePath();
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('تعذر حفظ ملف الجلسة الآمن:', err);
  }
}

/**
 * تسجيل قنوات IPC
 */
export function setupIpcHandlers(): void {
  if (!ipcMain) return;

  // 1. فحص ping -> pong
  ipcMain.handle('ping', () => 'pong');

  // 2. safeStorage للجلسات
  ipcMain.handle('session:get', async (_event: any, key: string) => {
    try {
      const store = readSessionStore();
      const encryptedBase64 = store[key];
      if (!encryptedBase64) return null;

      if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(encryptedBase64, 'base64');
        return safeStorage.decryptString(buffer);
      }
      return encryptedBase64;
    } catch (err) {
      console.warn(`فشل استرجاع الجلسة للمفتاح (${key}):`, err);
      return null;
    }
  });

  ipcMain.handle('session:set', async (_event: any, key: string, value: string) => {
    try {
      let storedValue = value;
      if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
        const encryptedBuffer = safeStorage.encryptString(value);
        storedValue = encryptedBuffer.toString('base64');
      }
      const store = readSessionStore();
      store[key] = storedValue;
      writeSessionStore(store);
      return true;
    } catch (err) {
      console.warn(`فشل حفظ الجلسة للمفتاح (${key}):`, err);
      return false;
    }
  });

  ipcMain.handle('session:remove', async (_event: any, key: string) => {
    try {
      const store = readSessionStore();
      delete store[key];
      writeSessionStore(store);
      return true;
    } catch {
      return false;
    }
  });

  // 3. حفظ الملفات saveFile
  ipcMain.handle('file:save', async (_event: any, payload: { filename: string; content: any; mimeType?: string }) => {
    try {
      const docsDir = app ? app.getPath('documents') : process.cwd();
      const targetPath = path.join(docsDir, payload.filename);
      let buffer: Buffer;
      if (typeof payload.content === 'string') {
        buffer = Buffer.from(payload.content, 'utf8');
      } else {
        buffer = Buffer.from(payload.content);
      }
      fs.writeFileSync(targetPath, buffer);
      return { success: true, path: targetPath };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  // 4. قناة PDF المعتمدة
  setupPdfIpcHandler(ipcMain, app, BrowserWindow, fs, path);
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
