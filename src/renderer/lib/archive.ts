/**
 * src/renderer/lib/archive.ts
 * خدمة أرشفة استمارات طلبات الشراء
 * - رفع ملف PDF إلى حاوية التخزين الخاصة request-pdfs في Supabase Storage
 * - تسجيل المسار المحلي الافتراضي (D10: Documents\ارشيف spc\<الرمز>.pdf) في pdf_local_path
 * - تسجيل مسار الحاوية السحابية في pdf_storage_path
 * - تحديث سجل الطلب في جدول requests
 */

import { supabase, isConfigured } from './supabase';

export interface ArchivePdfOptions {
  requestId: string;
  code: string;
  pdfData: Blob | Uint8Array | string;
  archiveDir?: string;
}

export interface ArchiveResult {
  success: boolean;
  pdf_local_path: string;
  pdf_storage_path?: string;
  error?: string;
}

/**
 * تنظيف رمز الطلب ليكون صالحاً كاسم ملف على القرص (القرار D3 و D10)
 */
export function getSafeCodeFilename(code: string): string {
  return `${code.replace(/[/\\?%*:|"<>]/g, '_').trim()}.pdf`;
}

/**
 * توليد المسار المحلي الافتراضي للملف وفق القرار D10
 */
export function buildDefaultLocalPath(code: string, customDir?: string): string {
  const filename = getSafeCodeFilename(code);
  const baseDir = (customDir || 'Documents\\ارشيف spc').replace(/[/\\]+$/, '');
  return `${baseDir}\\${filename}`;
}

/**
 * توليد مسار التخزين السحابي داخل الحاوية الخاصة
 */
export function buildStoragePath(requestId: string, code: string): string {
  const filename = getSafeCodeFilename(code);
  return `${requestId}/${filename}`;
}

export const archiveService = {
  /**
   * أرشفة ملف PDF للطلب وربطه بالسجل في قاعدة البيانات
   */
  async archivePdf(options: ArchivePdfOptions): Promise<ArchiveResult> {
    const { requestId, code, pdfData, archiveDir } = options;

    const localPath = buildDefaultLocalPath(code, archiveDir);
    const storagePath = buildStoragePath(requestId, code);

    // في حال عدم تهيئة Supabase (بيئة محلية أو تجريبية دون مفاتيح)
    if (!isConfigured) {
      return {
        success: true,
        pdf_local_path: localPath,
        pdf_storage_path: storagePath
      };
    }

    try {
      // 1. تجهيز الـ Blob المطلوب للرفع
      let blobToUpload: Blob;
      if (pdfData instanceof Blob) {
        blobToUpload = pdfData;
      } else if (typeof pdfData === 'string') {
        blobToUpload = new Blob([pdfData], { type: 'application/pdf' });
      } else {
        blobToUpload = new Blob([pdfData as BlobPart], { type: 'application/pdf' });
      }

      // 2. الرفع إلى حاوية request-pdfs في Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('request-pdfs')
        .upload(storagePath, blobToUpload, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`فشل رفع ملف الاستمارة إلى Storage: ${uploadError.message}`);
      }

      // 3. تحديث مسارات الأرشفة في جدول requests
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          pdf_local_path: localPath,
          pdf_storage_path: storagePath
        })
        .eq('id', requestId);

      if (updateError) {
        console.warn('تنبيه: تم رفع الملف ولكن تعذر تحديث المسارات في جدول requests:', updateError.message);
      }

      return {
        success: true,
        pdf_local_path: localPath,
        pdf_storage_path: storagePath
      };
    } catch (err: any) {
      return {
        success: false,
        pdf_local_path: localPath,
        error: err?.message || 'خطأ غير متوقع أثناء الأرشفة'
      };
    }
  }
};
