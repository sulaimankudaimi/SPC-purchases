/**
 * src/main/index.ts
 * العملية الرئيسية لتطبيق Electron (تُستعمل في حزمة سطح المكتب فقط وتُستبعد من بناء الويب)
 * - إعداد النافذة الآمنة وسياسة CSP
 * - قناة IPC واحدة لاستقبال بيانات الاستمارة المتحقَّقة واستدعاء printToPDF من نافذة خفية
 * - الحفظ إلى Documents\ارشيف spc\<الرمز>.pdf (D10)
 */

declare const process: any;

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

/**
 * دالة تهيئة نافذة Electron الآمنة (يتم استدعاؤها في main process الفعلي)
 */
export function setupSecureWindow(mainWindow: any): void {
  if (!mainWindow) return;

  // منع فتح نوافذ جديدة
  if (mainWindow.webContents && mainWindow.webContents.setWindowOpenHandler) {
    mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  }

  // منع التنقل الخارجي
  if (mainWindow.webContents && mainWindow.webContents.on) {
    mainWindow.webContents.on('will-navigate', (event: any, navigationUrl: string) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== 'http://localhost:3000' && parsedUrl.protocol !== 'file:') {
        event.preventDefault();
      }
    });
  }
}

/**
 * إعداد قناة IPC الموحّدة لتوليد وحفظ PDF عبر نافذة خفية و printToPDF (القرار D2 و D10)
 * القناة: 'spc:print-to-pdf'
 */
export function setupPdfIpcHandler(ipcMain: any, app: any, BrowserWindow: any, fs: any, path: any): void {
  if (!ipcMain) return;

  ipcMain.handle('spc:print-to-pdf', async (_event: any, payload: { code: string; html: string; archiveDir?: string }) => {
    const { code, html, archiveDir } = payload;
    if (!code || !html) {
      throw new Error('البيانات غير مكتملة لتوليد PDF.');
    }

    // 1. تحديد مسار الحفظ المحلي الافتراضي: Documents\ارشيف spc\<الرمز>.pdf (D10)
    const homeDir = app ? app.getPath('documents') : (process.env.USERPROFILE || process.env.HOME || '');
    const defaultArchiveDir = archiveDir || path.join(homeDir, 'ارشيف spc');
    
    if (fs && !fs.existsSync(defaultArchiveDir)) {
      fs.mkdirSync(defaultArchiveDir, { recursive: true });
    }

    const safeCodeFilename = `${code.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;
    const targetFilePath = path.join(defaultArchiveDir, safeCodeFilename);

    // 2. إنشاء نافذة خفية بالكامل دون عرض (Hidden BrowserWindow)
    const printWindow = new BrowserWindow({
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
      if (fs) {
        fs.writeFileSync(targetFilePath, pdfBuffer);
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
