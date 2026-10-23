/**
 * src/renderer/lib/platform.ts
 * واجهة منصة موحّدة (جلسة، صندوق صادر، حفظ ملف)
 * بتنفيذين: window.api في بيئة Electron، وبديل متصفحي (localStorage/Blob) داخل بيئة الويب / AI Studio
 */

export interface IPlatformSession {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface IPlatformOutbox {
  getQueue(): Promise<any[]>;
  enqueue(item: any): Promise<void>;
  dequeue(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IPlatformFile {
  saveFile(filename: string, content: Blob | string | Uint8Array, mimeType?: string): Promise<{ success: boolean; path?: string }>;
}

export interface IPlatform {
  readonly isElectron: boolean;
  ping(): Promise<string>;
  session: IPlatformSession;
  outbox: IPlatformOutbox;
  file: IPlatformFile;
}

// ---------------------------------------------------------------------------
// 1. التنفيذ المتصفحي (Browser / AI Studio Web Preview)
// ---------------------------------------------------------------------------
class BrowserPlatform implements IPlatform {
  readonly isElectron = false;

  async ping(): Promise<string> {
    return 'pong';
  }

  session: IPlatformSession = {
    async get(key: string): Promise<string | null> {
      try {
        return localStorage.getItem(`spc_session_${key}`);
      } catch {
        return null;
      }
    },
    async set(key: string, value: string): Promise<void> {
      try {
        localStorage.setItem(`spc_session_${key}`, value);
      } catch (err) {
        console.warn('فشل حفظ الجلسة في localStorage', err);
      }
    },
    async remove(key: string): Promise<void> {
      try {
        localStorage.removeItem(`spc_session_${key}`);
      } catch {
        // تجاهل
      }
    }
  };

  outbox: IPlatformOutbox = {
    async getQueue(): Promise<any[]> {
      try {
        const raw = localStorage.getItem('spc_outbox_queue');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    async enqueue(item: any): Promise<void> {
      try {
        const current = await this.getQueue();
        const updated = [...current, { ...item, _enqueuedAt: Date.now() }];
        localStorage.setItem('spc_outbox_queue', JSON.stringify(updated));
      } catch (err) {
        console.warn('فشل الإضافة إلى صندوق الصادر', err);
      }
    },
    async dequeue(id: string): Promise<void> {
      try {
        const current = await this.getQueue();
        const updated = current.filter((item) => item.id !== id && item._id !== id);
        localStorage.setItem('spc_outbox_queue', JSON.stringify(updated));
      } catch {
        // تجاهل
      }
    },
    async clear(): Promise<void> {
      try {
        localStorage.removeItem('spc_outbox_queue');
      } catch {
        // تجاهل
      }
    }
  };

  file: IPlatformFile = {
    async saveFile(filename: string, content: Blob | string | Uint8Array, mimeType = 'application/octet-stream'): Promise<{ success: boolean; path?: string }> {
      try {
        let blob: Blob;
        if (content instanceof Blob) {
          blob = content;
        } else if (typeof content === 'string') {
          blob = new Blob([content], { type: mimeType });
        } else {
          blob = new Blob([content as BlobPart], { type: mimeType });
        }

        if (typeof document !== 'undefined') {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        return { success: true, path: filename };
      } catch (err: any) {
        return { success: false, path: err?.message };
      }
    }
  };
}

// ---------------------------------------------------------------------------
// 2. التنفيذ في بيئة Electron عبر window.api
// ---------------------------------------------------------------------------
class ElectronPlatform implements IPlatform {
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
      if (api?.file?.saveFile) {
        return await api.file.saveFile(filename, content, mimeType);
      }
      // بديل حفظ عبر المتصفح في حال عدم توفر دالة native
      const browser = new BrowserPlatform();
      return await browser.file.saveFile(filename, content, mimeType);
    }
  };
}

// ---------------------------------------------------------------------------
// الكشف التلقائي وتصدير الكائن الموحّد
// ---------------------------------------------------------------------------
const isElectronEnv = typeof window !== 'undefined' && Boolean((window as any).api?.isElectron);

export const platform: IPlatform = isElectronEnv ? new ElectronPlatform() : new BrowserPlatform();
