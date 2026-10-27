/**
 * src/renderer/lib/platform.ts
 * واجهة منصة موحّدة (جلسة، صندوق صادر، حفظ ملف)
 * بتنفيذين: window.api في بيئة Electron، وبديل متصفحي (localStorage/IndexedDB) داخل بيئة الويب / AI Studio
 */

import { IPlatform } from './platformTypes';
import { BrowserPlatform } from './platformBrowser';
import { ElectronPlatform } from './platformElectron';

export type {
  IPlatformSession,
  IPlatformOutbox,
  IPlatformFile,
  IPlatform
} from './platformTypes';

export { BrowserPlatform } from './platformBrowser';
export { ElectronPlatform } from './platformElectron';

export function createPlatform(): IPlatform {
  return new BrowserPlatform();
}

const isElectronEnv = typeof window !== 'undefined' && Boolean((window as any).api?.isElectron);
export const platform: IPlatform = isElectronEnv ? new ElectronPlatform() : new BrowserPlatform();
