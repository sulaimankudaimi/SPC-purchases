/**
 * src/main/index.ts
 * العملية الرئيسية لتطبيق Electron (تُستعمل في حزمة سطح المكتب فقط وتُستبعد من بناء الويب)
 */

// إعلان الأنواع لبيئة Electron عند فحص TypeScript
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
