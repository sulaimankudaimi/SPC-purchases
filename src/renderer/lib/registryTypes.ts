/**
 * src/renderer/lib/registryTypes.ts
 * أنواع وبيانات واجهة سجل طلبات الشراء
 */

import { RequestStatus } from '../../shared/schema';

export interface RegistryItem {
  id: string;
  request_id: string;
  line_no: number;
  name: string;
  specs: string | null;
  unit: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  legacy_total?: number | null;
  notes: string | null;
}

export interface RegistryRequest {
  id: string;
  code: string;
  code_norm?: string;
  request_date: string;
  entity: string;
  requester: string;
  department: string | null;
  delivery_place: string | null;
  delivery_date: string | null;
  currency: string;
  status: RequestStatus;
  status_note: string | null;
  notes: string | null;
  signatories?: Record<string, string>;
  pdf_local_path: string | null;
  pdf_storage_path: string | null;
  invoice_storage_path: string | null;
  needs_review: boolean;
  legacy_row?: number | null;
  created_at?: string;
  updated_at?: string;
  deleted_at: string | null;
  items: RegistryItem[];
  items_count?: number;
  total_amount?: number;
  is_outbox?: boolean;
  needs_sync?: boolean;
}

export interface RegistryFilter {
  search?: string;
  status?: RequestStatus | 'all';
  fromDate?: string;
  toDate?: string;
  needsReviewOnly?: boolean;
}

export interface RegistryStats {
  totalRequests: number;
  totalItems: number;
  totalAmount: number;
  statusCounts: Record<RequestStatus, number>;
}
