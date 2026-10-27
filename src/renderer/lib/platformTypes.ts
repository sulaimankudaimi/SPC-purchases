/**
 * src/renderer/lib/platformTypes.ts
 * واجهات منصة التشغيل (المتصفح وElectron)
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
  saveFile(
    filename: string,
    content: Blob | string | Uint8Array,
    mimeType?: string
  ): Promise<{ success: boolean; path?: string }>;
  printHtml?(html: string): Promise<{ success: boolean; error?: string }>;
  exportPrHtml?(code: string, html: string): Promise<{ success: boolean; path?: string }>;
}

export interface IPlatform {
  readonly isElectron: boolean;
  ping(): Promise<string>;
  session: IPlatformSession;
  outbox: IPlatformOutbox;
  file: IPlatformFile;
}
