/**
 * src/preload/index.ts
 * سياق Preload الآمن لـ Electron (منظومة المشتريات)
 * - يعرض حصراً كائن window.api عبر contextBridge.exposeInMainWorld
 * - دوال ضيقة ومحددة فقط: ping، session.get/set/remove، printToPdf، saveFile
 * - حظر قاطع لتصدير أو عرض ipcRenderer نفسه إلى نافذة العميل
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  isElectron: boolean;
  platform: string;
  ping: () => Promise<string>;
  session: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<boolean>;
    remove: (key: string) => Promise<boolean>;
  };
  printToPdf: (payload: { code: string; html: string; archiveDir?: string }) => Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    sizeBytes?: number;
    error?: string;
  }>;
  saveFile: (
    filename: string,
    content: any,
    mimeType?: string
  ) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
}

const api: IElectronAPI = {
  isElectron: true,
  platform: typeof process !== 'undefined' ? process.platform : 'win32',
  ping: () => ipcRenderer.invoke('ping'),
  session: {
    get: (key: string) => ipcRenderer.invoke('session:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('session:set', key, value),
    remove: (key: string) => ipcRenderer.invoke('session:remove', key)
  },
  printToPdf: (payload: { code: string; html: string; archiveDir?: string }) =>
    ipcRenderer.invoke('spc:print-to-pdf', payload),
  saveFile: (filename: string, content: any, mimeType?: string) =>
    ipcRenderer.invoke('file:save', { filename, content, mimeType })
};

if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function') {
  contextBridge.exposeInMainWorld('api', api);
}
