/**
 * src/renderer/components/request/RequestStatusBar.tsx
 * شريط حالة الاتصال والمزامنة وبطاقة نتيجة حفظ طلب الشراء
 */

import React from 'react';
import {
  FilePlus2,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';

export interface ResultMessage {
  type: 'success' | 'error' | 'offline';
  title: string;
  description: string;
  code?: string;
}

interface RequestStatusBarProps {
  simulateOffline: boolean;
  onToggleSimulateOffline: () => void;
  pendingCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
  resultMessage: ResultMessage | null;
}

export const RequestStatusBar: React.FC<RequestStatusBarProps> = ({
  simulateOffline,
  onToggleSimulateOffline,
  pendingCount,
  isSyncing,
  onSyncNow,
  resultMessage
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <FilePlus2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">إنشاء طلب شراء محلي جديد</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إدخال وتوثيق طلبات الشراء المحلي والمواد لدائرة الإمداد والتوريد
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onToggleSimulateOffline}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              simulateOffline ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            {simulateOffline ? <WifiOff className="w-3.5 h-3.5 text-amber-600" /> : <Wifi className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{simulateOffline ? 'محاكاة: غير متصل' : 'متصل بالشبكة'}</span>
          </button>

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>مزامنة ({pendingCount})</span>
            </button>
          )}
        </div>
      </div>

      {resultMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
            resultMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : resultMessage.type === 'offline'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {resultMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          ) : resultMessage.type === 'offline' ? (
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h4 className="font-bold">{resultMessage.title}</h4>
            <p className="text-[11px] leading-relaxed">{resultMessage.description}</p>
          </div>
        </div>
      )}
    </>
  );
};
