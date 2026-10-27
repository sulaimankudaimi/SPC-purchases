/**
 * src/renderer/lib/platformBrowser.ts
 * التنفيذ المتصفحي (Browser / AI Studio Web Preview)
 * - مخزن IndexedDB للصندوق الصادر مع ترحيل تلقائي من localStorage
 * - إدارة الجلسة عبر التخزين المحلي
 * - حفظ وطباعة وتصدير الملفات
 */

import { IPlatform, IPlatformSession, IPlatformOutbox, IPlatformFile } from './platformTypes';

export class BrowserPlatform implements IPlatform {
  readonly isElectron = false;
  private static sharedMemoryStore = new Map<string, string>();

  private getStorage(): {
    getItem(k: string): string | null;
    setItem(k: string, v: string): void;
    removeItem(k: string): void;
  } {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return {
      getItem: (k: string) => BrowserPlatform.sharedMemoryStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        BrowserPlatform.sharedMemoryStore.set(k, v);
      },
      removeItem: (k: string) => {
        BrowserPlatform.sharedMemoryStore.delete(k);
      }
    };
  }

  async ping(): Promise<string> {
    return 'pong';
  }

  session: IPlatformSession = {
    get: async (key: string): Promise<string | null> => {
      try {
        return this.getStorage().getItem(`spc_session_${key}`);
      } catch {
        return null;
      }
    },
    set: async (key: string, value: string): Promise<void> => {
      try {
        this.getStorage().setItem(`spc_session_${key}`, value);
      } catch (err) {
        console.warn('فشل حفظ الجلسة في منصة التخزين', err);
      }
    },
    remove: async (key: string): Promise<void> => {
      try {
        this.getStorage().removeItem(`spc_session_${key}`);
      } catch {
        // تجاهل
      }
    }
  };

  private async getIndexedDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' && typeof globalThis.indexedDB === 'undefined') {
      return null;
    }
    const idbFactory = (typeof window !== 'undefined' ? window.indexedDB : null) || globalThis.indexedDB;
    if (!idbFactory) return null;

    return new Promise((resolve) => {
      try {
        const req = idbFactory.open('spc_offline_db', 1);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains('outbox')) {
            db.createObjectStore('outbox', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async migrateLocalStorageToIndexedDB(db: IDBDatabase): Promise<void> {
    try {
      const storage = this.getStorage();
      const raw = storage.getItem('spc_outbox_queue');
      if (!raw) return;
      const legacyItems: any[] = JSON.parse(raw);
      if (Array.isArray(legacyItems) && legacyItems.length > 0) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction('outbox', 'readwrite');
          const store = tx.objectStore('outbox');
          for (const item of legacyItems) {
            store.put(item);
          }
          tx.oncomplete = () => {
            storage.removeItem('spc_outbox_queue');
            resolve();
          };
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // تجاهل أخطاء الترحيل
    }
  }

  outbox: IPlatformOutbox = {
    getQueue: async (): Promise<any[]> => {
      try {
        const db = await this.getIndexedDB();
        if (db) {
          await this.migrateLocalStorageToIndexedDB(db);
          return new Promise((resolve) => {
            const tx = db.transaction('outbox', 'readonly');
            const store = tx.objectStore('outbox');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
        }
      } catch {
        // fallback
      }
      try {
        const raw = this.getStorage().getItem('spc_outbox_queue');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    enqueue: async (item: any): Promise<void> => {
      const enriched = { ...item, _enqueuedAt: Date.now() };
      try {
        const db = await this.getIndexedDB();
        if (db) {
          await this.migrateLocalStorageToIndexedDB(db);
          return new Promise((resolve) => {
            const tx = db.transaction('outbox', 'readwrite');
            const store = tx.objectStore('outbox');
            store.put(enriched);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
        }
      } catch {
        // fallback
      }
      try {
        const current = await this.outbox.getQueue();
        const existingIdx = current.findIndex((i) => i.id === enriched.id);
        if (existingIdx >= 0) {
          current[existingIdx] = enriched;
        } else {
          current.push(enriched);
        }
        this.getStorage().setItem('spc_outbox_queue', JSON.stringify(current));
      } catch (err) {
        console.warn('فشل الإضافة إلى صندوق الصادر', err);
      }
    },
    dequeue: async (id: string): Promise<void> => {
      try {
        const db = await this.getIndexedDB();
        if (db) {
          return new Promise((resolve) => {
            const tx = db.transaction('outbox', 'readwrite');
            const store = tx.objectStore('outbox');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
        }
      } catch {
        // fallback
      }
      try {
        const current = await this.outbox.getQueue();
        const updated = current.filter((item) => item.id !== id && item._id !== id);
        this.getStorage().setItem('spc_outbox_queue', JSON.stringify(updated));
      } catch {
        // تجاهل
      }
    },
    clear: async (): Promise<void> => {
      try {
        const db = await this.getIndexedDB();
        if (db) {
          return new Promise((resolve) => {
            const tx = db.transaction('outbox', 'readwrite');
            const store = tx.objectStore('outbox');
            store.clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
        }
      } catch {
        // fallback
      }
      try {
        this.getStorage().removeItem('spc_outbox_queue');
      } catch {
        // تجاهل
      }
    }
  };

  file: IPlatformFile = {
    async saveFile(
      filename: string,
      content: Blob | string | Uint8Array,
      mimeType = 'application/octet-stream'
    ): Promise<{ success: boolean; path?: string }> {
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
    },
    async printHtml(html: string): Promise<{ success: boolean; error?: string }> {
      try {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
          return { success: false, error: 'نافذة المتصفح غير متاحة للطباعة' };
        }
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
        const doc = printFrame.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => {
            try {
              printFrame.contentWindow?.focus();
              printFrame.contentWindow?.print();
            } finally {
              setTimeout(() => {
                if (document.body.contains(printFrame)) {
                  document.body.removeChild(printFrame);
                }
              }, 2000);
            }
          }, 350);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    },
    async exportPrHtml(code: string, html: string): Promise<{ success: boolean; path?: string }> {
      const filename = `${code.replace(/[/\\?%*:|"<>]/g, '_')}.html`;
      return this.saveFile(filename, html, 'text/html;charset=utf-8');
    }
  };
}
