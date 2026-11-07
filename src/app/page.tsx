"use client";

import { useEffect, useMemo, useState } from "react";
import ReceiptForm, { createEmptyItem } from "@/components/ReceiptForm";
import ReceiptPreview from "@/components/ReceiptPreview";
import {
  OFFICE_INFO,
  generateReceiptNumber,
  nowISO,
} from "@/lib/static-data";
import { calculateTotals, mockUUID } from "@/lib/calculations";
import type { Receipt } from "@/lib/types";

// إنشاء إيصال جديد بالبيانات الافتراضية
function createEmptyReceipt(): Receipt {
  const items = [
    {
      ...createEmptyItem(),
      description: "خدمات محاسبية ومراجعة",
      unitPrice: 1000,
      quantity: 1,
    },
  ];
  return {
    receiptNumber: generateReceiptNumber(),
    receiptType: "cash",
    dateTime: nowISO(),
    seller: OFFICE_INFO,
    buyer: {
      name: "",
      type: "person",
      taxNumber: "",
      nationalId: "",
      address: "",
      phone: "",
    },
    items,
    paymentMethod: "cash",
    totals: calculateTotals(items),
    notes: "",
    submission: {
      status: "draft",
    },
  };
}

// مفتاح الـ localStorage
const DRAFT_KEY = "eta-receipt-draft";
const HISTORY_KEY = "eta-receipt-history";

export default function Home() {
  const [receipt, setReceipt] = useState<Receipt>(createEmptyReceipt);
  const [history, setHistory] = useState<Receipt[]>([]);
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // تحميل المسودة والسجل من localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft) as Receipt;
        if (parsed?.submission?.status === "draft") {
          // بيانات المكتب ثابتة؛ نحدّثها في المسودة دون تغيير بيانات العميل أو الأصناف.
          setReceipt({ ...parsed, seller: OFFICE_INFO });
        }
      }
      const hist = localStorage.getItem(HISTORY_KEY);
      if (hist) setHistory(JSON.parse(hist));
    } catch {}
  }, []);

  // حفظ المسودة تلقائياً
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(receipt));
    } catch {}
  }, [receipt]);

  // حفظ السجل
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  // Toast timer
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const canSubmit = useMemo(() => {
    return (
      receipt.buyer.name.trim() !== "" &&
      receipt.items.length > 0 &&
      receipt.items.every((i) => i.description.trim() !== "")
    );
  }, [receipt]);

  function handlePrint() {
    window.print();
  }

  function handleNewReceipt() {
    setReceipt(createEmptyReceipt());
    setActiveTab("new");
    setToast({ type: "info", message: "تم إنشاء إيصال جديد" });
  }

  function handleMockSubmit() {
    if (!canSubmit) {
      setToast({
        type: "error",
        message: "من فضلك أكمل بيانات العميل والأصناف أولاً",
      });
      return;
    }

    // محاكاة الإرسال لمصلحة الضرائب
    setReceipt({
      ...receipt,
      submission: { status: "submitted", submittedAt: nowISO() },
    });

    setToast({
      type: "info",
      message: "جاري إرسال الإيصال لمصلحة الضرائب (محاكاة)...",
    });

    setTimeout(() => {
      // محاكاة نجاح 90% من الحالات
      const success = Math.random() > 0.1;
      const finalReceipt: Receipt = {
        ...receipt,
        submission: success
          ? {
              status: "accepted",
              submittedAt: nowISO(),
              uuid: mockUUID(),
            }
          : {
              status: "rejected",
              submittedAt: nowISO(),
              errorMessage: "بيانات العميل غير مكتملة",
            },
      };
      setReceipt(finalReceipt);

      if (success) {
        // إضافة للسجل
        setHistory((h) => [finalReceipt, ...h].slice(0, 50));
        localStorage.removeItem(DRAFT_KEY);
        setToast({
          type: "success",
          message:
            "✅ تم إرسال الإيصال وقبوله بنجاح! يمكنك الآن طباعته للعميل.",
        });
      } else {
        setToast({
          type: "error",
          message: "❌ تم رفض الإيصال من مصلحة الضرائب (محاكاة)",
        });
      }
    }, 1800);
  }

  function loadFromHistory(r: Receipt) {
    setReceipt(r);
    setActiveTab("new");
    setToast({ type: "info", message: "تم تحميل الإيصال من السجل" });
  }

  const statusBadge = receipt.submission && (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        receipt.submission.status === "accepted"
          ? "bg-green-100 text-green-800"
          : receipt.submission.status === "rejected" ||
            receipt.submission.status === "failed"
          ? "bg-red-100 text-red-800"
          : receipt.submission.status === "submitted"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {receipt.submission.status === "accepted" && "✓ مقبول"}
      {receipt.submission.status === "submitted" && "⏳ قيد الإرسال"}
      {receipt.submission.status === "rejected" && "✗ مرفوض"}
      {receipt.submission.status === "failed" && "✗ فشل الإرسال"}
      {receipt.submission.status === "draft" && "📝 مسودة"}
    </span>
  );

  return (
    <div className="min-h-screen">
      {/* الهيدر */}
      <header className="no-print bg-[var(--brand)] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              نظام الإيصالات الإلكترونية
            </h1>
            <p className="text-sm text-white/80">
              {OFFICE_INFO.name} • مكتب محاسب قانوني
            </p>
          </div>
          <div className="flex items-center gap-2">{statusBadge}</div>
        </div>
      </header>

      {/* التابات */}
      <nav className="no-print bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          <button
            onClick={() => setActiveTab("new")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "new"
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            إيصال جديد
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "history"
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            سجل الإيصالات ({history.length})
          </button>
          <div className="flex-1" />
          <button
            onClick={handleNewReceipt}
            className="my-2 px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            + إيصال جديد
          </button>
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div
          className={`no-print fixed top-4 left-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium max-w-sm ${
            toast.type === "success"
              ? "bg-green-600"
              : toast.type === "error"
              ? "bg-red-600"
              : "bg-blue-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "new" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* العمود الأيمن: الفورم */}
            <div className="no-print">
              <ReceiptForm receipt={receipt} setReceipt={setReceipt} />

              {/* أزرار الإجراءات */}
              <div className="mt-6 bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-wrap gap-3">
                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition flex items-center gap-2"
                >
                  🖨️ طباعة الإيصال
                </button>
                <button
                  onClick={handleMockSubmit}
                  disabled={
                    receipt.submission?.status === "submitted" ||
                    receipt.submission?.status === "accepted"
                  }
                  className="px-5 py-2.5 bg-[var(--brand)] text-white rounded-lg font-medium hover:bg-[var(--brand-dark)] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  📤 إرسال لمصلحة الضرائب
                </button>
                <button
                  onClick={handleNewReceipt}
                  className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
                >
                  🔄 مسح وبدء جديد
                </button>
              </div>

              {/* ملاحظة المرحلة */}
              <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-4 text-sm">
                <div className="font-bold mb-1">💡 المرحلة الحالية: البيانات الثابتة (Static)</div>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-800 mt-2">
                  <li>بيانات المكتب محفوظة في <code className="bg-blue-100 px-1 rounded">src/lib/static-data.ts</code></li>
                  <li>جميع الإيصالات محفوظة في الـ localStorage فقط</li>
                  <li>زر "الإرسال للضرائب" محاكاة بدون اتصال حقيقي بالـ API</li>
                  <li>تم تجهيز خطوة Supabase الأولى: ملف إعدادات ومخطط جداول وفحص اتصال</li>
                  <li>الحفظ ما زال محلياً حتى نضيف تسجيل الدخول وصلاحيات المكتب</li>
                  <li>
                    حالة الاتصال:{" "}
                    <a className="underline font-medium" href="/api/supabase/status" target="_blank" rel="noreferrer">
                      /api/supabase/status
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* العمود الأيسر: المعاينة */}
            <div>
              <div className="no-print mb-3 text-sm font-semibold text-slate-600 text-center">
                👁️ معاينة الإيصال (شكل الطباعة)
              </div>
              <ReceiptPreview receipt={receipt} />
            </div>
          </div>
        ) : (
          // سجل الإيصالات
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <div className="text-4xl mb-2">📭</div>
                <div className="text-lg font-medium">لا يوجد إيصات بعد</div>
                <div className="text-sm mt-1">
                  الإيصات المقبولة من مصلحة الضرائب ستظهر هنا
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
                      <th className="px-4 py-3 text-right font-semibold">
                        العميل
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        التاريخ
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        الإجمالي
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        الحالة
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        UUID
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr
                        key={h.receiptNumber + h.submission?.uuid}
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
                            <span className="text-green-700 text-xs">
                              ✓ مقبول
                            </span>
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
                            onClick={() => loadFromHistory(h)}
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
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-slate-500">
          نظام الإيصالات الإلكترونية • مرحلة التطوير الأولى (Static Data) •
          {OFFICE_INFO.name}
        </div>
      </footer>
    </div>
  );
}
