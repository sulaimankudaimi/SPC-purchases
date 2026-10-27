/**
 * src/renderer/lib/requestValidation.ts
 * دوال التحقق وتوليد المعرفات والرموز المؤقتة للطلبات الجديدة
 */

import { RequestInput } from './requestTypes';
import { getSettings, SignatoriesSettings } from './settings';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateTemporaryCode(date: string, id: string): string {
  const shortId = id.replace(/-/g, '').slice(0, 6);
  return `مؤقت (${date}-${shortId})`;
}

export async function buildSignatoriesSnapshot(requesterName: string): Promise<SignatoriesSettings> {
  const currentSettings = await getSettings();
  const snapshot: SignatoriesSettings = { ...currentSettings.signatories };

  if (currentSettings.auto_fill_requester.enabled) {
    snapshot.requester = requesterName.trim();
  }

  return snapshot;
}

export function validateRequestInput(data: RequestInput): string | null {
  if (!data.entity || data.entity.trim() === '') {
    return 'الجهة الطالبة حقل إلزامي.';
  }
  if (!data.requester || data.requester.trim() === '') {
    return 'مقدم الطلب حقل إلزامي.';
  }
  if (!data.request_date) {
    return 'تاريخ طلب الشراء إلزامي.';
  }
  if (!data.items || data.items.length === 0) {
    return 'يجب إضافة مادة واحدة على الأقل في الطلب.';
  }

  for (let i = 0; i < data.items.length; i++) {
    const itm = data.items[i];
    if (!itm.name || itm.name.trim() === '') {
      return `المادة رقم ${i + 1}: اسم المادة حقل إلزامي.`;
    }
    if (typeof itm.qty !== 'number' || isNaN(itm.qty) || itm.qty <= 0) {
      return `المادة (${itm.name}): الكمية يجب أن تكون أكبر من الصفر.`;
    }
    if (typeof itm.unit_price !== 'number' || isNaN(itm.unit_price) || itm.unit_price < 0) {
      return `المادة (${itm.name}): السعر التقديري يجب ألا يكون سالباً.`;
    }
  }

  return null;
}
