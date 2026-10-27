/**
 * src/main/ipcHandlers.ts
 * قنوات IPC لتطبيق Electron (طباعة PDF، التخزين الآمن للجلسات، حفظ الملفات)
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * إعداد قناة IPC الموحّدة لتوليد وحفظ PDF عبر نافذة خفية و printToPDF (القرار D2 و D10)
 */
export function setupPdfIpcHandler(
  ipc: any,
  electronApp: any,
  WindowClass: any,
  fileSystem: any,
  pathModule: any
): void {
  if (!ipc) return;

  ipc.handle('spc:print-to-pdf', async (_event: any, payload: { code: string; html: string; archiveDir?: string }) => {
    const { code, html, archiveDir } = payload;
    if (!code || !html) {
      throw new Error('البيانات غير مكتملة لتوليد PDF.');
    }

    const homeDir = electronApp ? electronApp.getPath('documents') : process.env.USERPROFILE || process.env.HOME || '';
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
function getSessionStorePath(app: any): string {
  const userDir = app?.getPath ? app.getPath('userData') : process.cwd();
  return path.join(userDir, 'spc_session_store.json');
}

function readSessionStore(app: any): Record<string, string> {
  try {
    const storePath = getSessionStorePath(app);
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // تجاهل
  }
  return {};
}

function writeSessionStore(app: any, data: Record<string, string>): void {
  try {
    const storePath = getSessionStorePath(app);
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
export function setupIpcHandlers(
  ipcMain: any,
  app: any,
  BrowserWindow: any,
  safeStorage: any
): void {
  if (!ipcMain) return;

  // 1. فحص ping -> pong
  ipcMain.handle('ping', () => 'pong');

  // 2. safeStorage للجلسات
  ipcMain.handle('session:get', async (_event: any, key: string) => {
    try {
      const store = readSessionStore(app);
      const encryptedBase64 = store[key];
      if (!encryptedBase64) return null;

      if (
        safeStorage &&
        typeof safeStorage.isEncryptionAvailable === 'function' &&
        safeStorage.isEncryptionAvailable()
      ) {
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
      if (
        safeStorage &&
        typeof safeStorage.isEncryptionAvailable === 'function' &&
        safeStorage.isEncryptionAvailable()
      ) {
        const encryptedBuffer = safeStorage.encryptString(value);
        storedValue = encryptedBuffer.toString('base64');
      }
      const store = readSessionStore(app);
      store[key] = storedValue;
      writeSessionStore(app, store);
      return true;
    } catch (err) {
      console.warn(`فشل حفظ الجلسة للمفتاح (${key}):`, err);
      return false;
    }
  });

  ipcMain.handle('session:remove', async (_event: any, key: string) => {
    try {
      const store = readSessionStore(app);
      delete store[key];
      writeSessionStore(app, store);
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
