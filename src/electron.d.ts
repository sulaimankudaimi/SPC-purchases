/**
 * src/electron.d.ts
 * تعريفات TypeScript لبيئة Electron و Playwright لتفادي مشاكل الفحص النمطي في بيئة الويب / AI Studio
 */

declare module 'electron' {
  export const app: any;
  export const BrowserWindow: any;
  export const ipcMain: any;
  export const ipcRenderer: any;
  export const contextBridge: any;
  export const session: any;
  export const Menu: any;
  export const safeStorage: any;
}

declare module '@playwright/test' {
  export const test: any;
  export const expect: any;
  export const _electron: any;
  export type ElectronApplication = any;
  export type Page = any;
  export function defineConfig(config: any): any;
}
