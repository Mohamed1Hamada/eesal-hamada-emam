"use client";

import type { Receipt } from "@/lib/types";

interface Props {
  history: Receipt[];
  onOpenReceipt: (receipt: Receipt) => void;
}

export default function ReceiptHistoryTable({ history, onOpenReceipt }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {history.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          <div className="text-4xl mb-2">📭</div>
          <div className="text-lg font-medium">لا توجد إيصالات بعد</div>
          <div className="text-sm mt-1">
            الإيصالات المقبولة من مصلحة الضرائب ستظهر هنا
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-right font-semibold">
                  رقم الإيصال
                </th>
                <th className="px-4 py-3 text-right font-semibold">العميل</th>
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">الإجمالي</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold">UUID</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr
                  key={h.id ?? h.receiptNumber + (h.submission?.uuid ?? "")}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                    {h.receiptNumber}
                  </td>
                  <td className="px-4 py-3">{h.buyer.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(h.dateTime).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="px-4 py-3 font-semibold" dir="ltr">
                    {h.totals.total.toFixed(2)} ج.م
                  </td>
                  <td className="px-4 py-3">
                    {h.submission?.status === "accepted" && (
                      <span className="text-green-700 text-xs">✓ مقبول</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs text-slate-500"
                    dir="ltr"
                  >
                    {h.submission?.uuid?.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenReceipt(h)}
                      className="text-[var(--brand)] hover:underline text-xs font-medium"
                    >
                      فتح
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
