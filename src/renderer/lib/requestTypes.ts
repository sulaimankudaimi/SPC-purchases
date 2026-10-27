/**
 * src/renderer/lib/requestTypes.ts
 * أنواع ومدخلات خدمة حفظ ومزامنة طلبات الشراء
 */

import { SignatoriesSettings } from './settings';

export interface RequestItemInput {
  id?: string;
  line_no?: number;
  name: string;
  specs?: string;
  unit?: string;
  qty: number;
  unit_price: number;
  notes?: string;
}

export interface RequestInput {
  id?: string;
  request_date: string;
  entity: string;
  requester: string;
  department?: string;
  delivery_place?: string;
  delivery_date?: string;
  currency?: string;
  notes?: string;
  items: RequestItemInput[];
}

export interface SaveRequestOptions {
  online?: boolean;
  simulateConflictAttempts?: number;
  isConfigured?: boolean;
  isOfflineDemoAllowed?: boolean;
}

export interface SaveRequestResult {
  success: boolean;
  code?: string;
  requestId?: string;
  offline?: boolean;
  outboxId?: string;
  error?: string;
}

export interface OutboxRequestItem {
  id: string;
  temp_code: string;
  data: RequestInput;
  signatories: SignatoriesSettings;
  status: 'pending_code';
  enqueued_at: string;
}

export interface SyncOutboxResult {
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  results: Array<{ id: string; code?: string; tempCode?: string; success: boolean; error?: string }>;
}
