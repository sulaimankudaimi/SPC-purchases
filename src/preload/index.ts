/**
 * src/preload/index.ts
 * سياق Preload الآمن لـ Electron - يعرض فقط window.api الضيق عبر contextBridge
 * - منع تسريب ipcRenderer إلى بيئة العرض تماماً
 * - دوال: ping، session.get/set/remove، printToPdf، saveFile
 */

import * as electronModule from 'electron';

const electron: any = (electronModule as any).contextBridge
  ? electronModule
  : (electronModule as any).default && typeof (electronModule as any).default === 'object'
  ? (electronModule as any).default
  : {};

export const contextBridge = electron.contextBridge;
export const ipcRenderer = electron.ipcRenderer;

export interface IElectronSessionAPI {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<boolean>;
}

export interface IElectronAPI {
  ping: () => Promise<string>;
  session: IElectronSessionAPI;
  printToPdf: (payload: { code: string; html: string; archiveDir?: string }) => Promise<any>;
  saveFile: (name: string, data: any) => Promise<any>;
  isElectron: boolean;
  platform: string;
}

export const electronApi: IElectronAPI = {
  ping: () => ipcRenderer ? ipcRenderer.invoke('api:ping') : Promise.resolve('pong'),
  session: {
    get: (key: string) => ipcRenderer ? ipcRenderer.invoke('session:get', key) : Promise.resolve(null),
    set: (key: string, value: string) => ipcRenderer ? ipcRenderer.invoke('session:set', key, value) : Promise.resolve(true),
    remove: (key: string) => ipcRenderer ? ipcRenderer.invoke('session:remove', key) : Promise.resolve(true)
  },
  printToPdf: (payload: { code: string; html: string; archiveDir?: string }) =>
    ipcRenderer ? ipcRenderer.invoke('spc:print-to-pdf', payload) : Promise.resolve({ success: false }),
  saveFile: (name: string, data: any) =>
    ipcRenderer ? ipcRenderer.invoke('file:save', { name, data }) : Promise.resolve({ success: false }),
  isElectron: true,
  platform: typeof process !== 'undefined' ? process.platform : 'unknown'
};

if (typeof contextBridge !== 'undefined' && contextBridge && contextBridge.exposeInMainWorld) {
  try {
    contextBridge.exposeInMainWorld('api', electronApi);
  } catch (err) {
    console.error('Failed to expose api to main world:', err);
  }
}
