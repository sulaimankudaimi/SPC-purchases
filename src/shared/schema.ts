/**
 * src/shared/schema.ts
 * تعريفات ومخططات Zod للطلبات والمواد والحالات (مطابقة لقيود DATA_MODEL.md والقرارين D3 وD4)
 */

import { z } from 'zod';
import { roundMoney } from './money';

// ---------------------------------------------------------------------------
// 1. حالات الطلب (القرار D4)
// ---------------------------------------------------------------------------
export const RequestStatusEnum = z.enum(['pending', 'executed', 'on_hold', 'rejected', 'cancelled']);

export type RequestStatus = z.infer<typeof RequestStatusEnum>;

export const STATUS_ARABIC_LABELS: Record<RequestStatus, string> = {
  pending: 'قيد الانتظار',
  executed: 'تم التنفيذ',
  on_hold: 'تريث',
  rejected: 'مرفوض',
  cancelled: 'ملغى'
};

// ---------------------------------------------------------------------------
// 2. مخطط مواد الطلب (request_items)
// ---------------------------------------------------------------------------
export const RequestItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    request_id: z.string().uuid().optional(),
    line_no: z.number().int().min(1, 'رقم السطر يجب أن يكون 1 على الأقل'),
    name: z.string().trim().min(1, 'اسم المادة أو الخدمة مطلوب'),
    specs: z.string().trim().nullable().optional(),
    unit: z.string().trim().nullable().optional(),
    qty: z.number().positive('الكمية يجب أن تكون أكبر تماماً من صفر (qty > 0)'),
    unit_price: z.number().nonnegative('السعر الإفرادي لا يمكن أن يكون سالباً (unit_price >= 0)'),
    line_total: z.number().optional(),
    legacy_total: z.number().nullable().optional(),
    notes: z.string().trim().nullable().optional()
  })
  .transform((item) => {
    // حساب line_total آلياً إن لم يكن محدداً (مطابقاً للعمود المخزن generated always)
    const calculatedTotal = roundMoney(item.qty * item.unit_price);
    return {
      ...item,
      line_total: item.line_total ?? calculatedTotal
    };
  });

export type RequestItemInput = z.input<typeof RequestItemSchema>;
export type RequestItem = z.output<typeof RequestItemSchema>;

// ---------------------------------------------------------------------------
// 3. أسماء التواقيع (signatories)
// ---------------------------------------------------------------------------
export const SignatoriesSchema = z.record(z.string(), z.string()).default({});
export type Signatories = z.infer<typeof SignatoriesSchema>;

// ---------------------------------------------------------------------------
// 4. مخطط الطلب الرئيسي (requests)
// ---------------------------------------------------------------------------
export const RequestSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1, 'رمز الطلب مطلوب'),
  code_norm: z.string().optional(),
  request_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ يجب أن تكون YYYY-MM-DD'),
  entity: z.string().trim().min(1, 'الجهة الطالبة مطلوبة'),
  requester: z.string().trim().min(1, 'مقدم الطلب مطلوب'),
  department: z.string().trim().nullable().optional(),
  delivery_place: z.string().trim().nullable().optional(),
  delivery_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة موعد التسليم يجب أن تكون YYYY-MM-DD')
    .nullable()
    .optional(),
  currency: z.string().trim().default('ليرة سورية جديدة'),
  status: RequestStatusEnum.default('pending'),
  status_note: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  signatories: SignatoriesSchema,
  pdf_local_path: z.string().nullable().optional(),
  pdf_storage_path: z.string().nullable().optional(),
  invoice_storage_path: z.string().nullable().optional(),
  needs_review: z.boolean().default(false),
  legacy_row: z.number().int().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
  deleted_at: z.string().datetime({ offset: true }).nullable().optional()
});

export type RequestInput = z.input<typeof RequestSchema>;
export type Request = z.output<typeof RequestSchema>;

// ---------------------------------------------------------------------------
// 5. مخطط الطلب الكامل شاملاً مواده
// ---------------------------------------------------------------------------
export const CompleteRequestSchema = RequestSchema.extend({
  items: z.array(RequestItemSchema).min(1, 'يجب أن يحتوي الطلب على مادة واحدة على الأقل')
});

export type CompleteRequest = z.infer<typeof CompleteRequestSchema>;
