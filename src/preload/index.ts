/**
 * src/preload/index.ts
 * سياق Preload الآمن لـ Electron - يعرض فقط window.api عبر contextBridge
 */

export interface IElectronAPI {
  ping: () => Promise<string> | string;
  isElectron: boolean;
  platform: string;
}

export const electronApi: IElectronAPI = {
  ping: () => 'pong',
  isElectron: true,
  platform: typeof process !== 'undefined' ? process.platform : 'unknown'
};

// في بيئة Electron الحقيقية يتم استدعاء:
// import { contextBridge, ipcRenderer } from 'electron';
// contextBridge.exposeInMainWorld('api', { ping: () => ipcRenderer.invoke('ping') });
