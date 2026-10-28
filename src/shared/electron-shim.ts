/**
 * src/shared/electron-shim.ts
 * بديل آمن لحزمة electron في بيئة المتصفح والويب (AI Studio)
 * يمنع تحميل node_modules/electron/index.js في المتصفح الذي يعتمد على بيئة Node وخاصية __dirname
 */

export const app: any = undefined;
export const BrowserWindow: any = undefined;
export const ipcMain: any = undefined;
export const ipcRenderer: any = undefined;
export const session: any = undefined;
export const Menu: any = undefined;
export const safeStorage: any = undefined;
export const contextBridge: any = undefined;

export default {
  app,
  BrowserWindow,
  ipcMain,
  ipcRenderer,
  session,
  Menu,
  safeStorage,
  contextBridge
};
