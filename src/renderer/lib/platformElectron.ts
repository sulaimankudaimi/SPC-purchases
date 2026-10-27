/**
 * src/renderer/lib/platformElectron.ts
 * التنفيذ في بيئة Electron عبر window.api
 */

import { IPlatform, IPlatformSession, IPlatformOutbox, IPlatformFile } from './platformTypes';
import { BrowserPlatform } from './platformBrowser';

export class ElectronPlatform implements IPlatform {
  readonly isElectron = true;

  private get api(): any {
    return typeof window !== 'undefined' ? (window as any).api : null;
  }

  async ping(): Promise<string> {
    if (this.api?.ping) {
      return await this.api.ping();
    }
    return 'pong';
  }

  session: IPlatformSession = {
    get: async (key: string) => {
      const api = (window as any)?.api;
      if (api?.session?.get) return await api.session.get(key);
      return localStorage.getItem(`spc_session_${key}`);
    },
    set: async (key: string, value: string) => {
      const api = (window as any)?.api;
      if (api?.session?.set) {
        await api.session.set(key, value);
      } else {
        localStorage.setItem(`spc_session_${key}`, value);
      }
    },
    remove: async (key: string) => {
      const api = (window as any)?.api;
      if (api?.session?.remove) {
        await api.session.remove(key);
      } else {
        localStorage.removeItem(`spc_session_${key}`);
      }
    }
  };

  outbox: IPlatformOutbox = {
    getQueue: async () => {
      const api = (window as any)?.api;
      if (api?.outbox?.getQueue) return await api.outbox.getQueue();
      const raw = localStorage.getItem('spc_outbox_queue');
      return raw ? JSON.parse(raw) : [];
    },
    enqueue: async (item: any) => {
      const api = (window as any)?.api;
      if (api?.outbox?.enqueue) {
        await api.outbox.enqueue(item);
      } else {
        const raw = localStorage.getItem('spc_outbox_queue');
        const list = raw ? JSON.parse(raw) : [];
        list.push({ ...item, _enqueuedAt: Date.now() });
        localStorage.setItem('spc_outbox_queue', JSON.stringify(list));
      }
    },
    dequeue: async (id: string) => {
      const api = (window as any)?.api;
      if (api?.outbox?.dequeue) {
        await api.outbox.dequeue(id);
      } else {
        const raw = localStorage.getItem('spc_outbox_queue');
        if (!raw) return;
        const list = JSON.parse(raw).filter((i: any) => i.id !== id && i._id !== id);
        localStorage.setItem('spc_outbox_queue', JSON.stringify(list));
      }
    },
    clear: async () => {
      const api = (window as any)?.api;
      if (api?.outbox?.clear) {
        await api.outbox.clear();
      } else {
        localStorage.removeItem('spc_outbox_queue');
      }
    }
  };

  file: IPlatformFile = {
    saveFile: async (filename: string, content: Blob | string | Uint8Array, mimeType?: string) => {
      const api = (window as any)?.api;
      if (api?.saveFile) {
        return await api.saveFile(filename, content, mimeType);
      }
      if (api?.file?.saveFile) {
        return await api.file.saveFile(filename, content, mimeType);
      }
      const browser = new BrowserPlatform();
      return await browser.file.saveFile(filename, content, mimeType);
    },
    printHtml: async (html: string) => {
      const api = (window as any)?.api;
      if (api?.printToPdf) {
        const res = await api.printToPdf({ code: 'print', html });
        return { success: res.success, error: res.error };
      }
      if (api?.pdf?.printHtml) {
        return await api.pdf.printHtml(html);
      }
      const browser = new BrowserPlatform();
      return await browser.file.printHtml!(html);
    },
    exportPrHtml: async (code: string, html: string) => {
      const api = (window as any)?.api;
      if (api?.printToPdf) {
        const res = await api.printToPdf({ code, html });
        return { success: res.success, path: res.filePath };
      }
      if (api?.pdf?.exportPrHtml) {
        return await api.pdf.exportPrHtml(code, html);
      }
      const browser = new BrowserPlatform();
      return await browser.file.exportPrHtml!(code, html);
    }
  };
}
