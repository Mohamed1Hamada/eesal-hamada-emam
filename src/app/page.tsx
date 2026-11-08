"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ReceiptForm from "@/components/ReceiptForm";
import ReceiptPreview from "@/components/ReceiptPreview";
import ReceiptHistoryTable from "@/components/ReceiptHistoryTable";
import LoginScreen from "@/components/LoginScreen";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { OFFICE_INFO, nowISO } from "@/lib/static-data";
import {
  generateUUID,
  validateReceiptForSubmission,
} from "@/lib/calculations";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createEmptyReceipt,
  receiptRepository,
} from "@/lib/receipt-repository";
import type { Receipt } from "@/lib/types";

const emptySubscribe = () => () => {};

export default function Home() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isClient) {
    return <AppShellHeader />;
  }

  if (isSupabaseConfigured()) {
    return <AuthenticatedApp />;
  }

  return <ReceiptApp userEmail={null} onSignOut={null} />;
}

function AuthenticatedApp() {
  const { session, checkingAuth, signOut } = useSupabaseSession();

  if (checkingAuth) {
    return (
      <AppShellHeader message="جاري التحقق من جلسة الدخول..." />
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <ReceiptApp
      userEmail={session.user.email ?? null}
      onSignOut={signOut}
    />
  );
}

function AppShellHeader({ message }: { message?: string }) {
  return (
    <div className="min-h-screen">
      <header className="no-print bg-[var(--brand)] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl md:text-2xl font-bold">
            نظام الإيصالات الإلكترونية
          </h1>
          <p className="text-sm text-white/80">
            {OFFICE_INFO.name} • مكتب محاسب قانوني
          </p>
        </div>
      </header>
      {message && (
        <main className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-slate-500">
          {message}
        </main>
      )}
    </div>
  );
}

function ReceiptApp({
  userEmail,
  onSignOut,
}: {
  userEmail: string | null;
  onSignOut: (() => void) | null;
}) {
  const [initialState] = useState(() => {
    const savedDraft = receiptRepository.loadDraft();
    return {
      hadSavedDraft: savedDraft !== null,
      receipt: savedDraft ?? createEmptyReceipt(),
    };
  });

  const [receipt, setReceipt] = useState<Receipt>(initialState.receipt);
  const [history, setHistory] = useState<Receipt[]>([]);
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تحميل السجل + تخصيص رقم متسلسل لأول إيصال جديد إذا لم توجد مسودة سابقة
  useEffect(() => {
    let active = true;

    receiptRepository
      .listReceipts()
      .then((items) => {
        if (active) setHistory(items);
      })
      .catch(() => {});

    if (!initialState.hadSavedDraft && receiptRepository.mode === "supabase") {
      receiptRepository
        .nextReceiptNumber()
        .then((seqNumber) => {
          if (!active) return;
          setReceipt((current) =>
            current.id === initialState.receipt.id &&
            current.submission?.status === "draft"
              ? { ...current, receiptNumber: seqNumber }
              : current
          );
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [initialState]);

  // حفظ المسودة تلقائياً (أو مسحها عند قبول الإيصال)
  useEffect(() => {
    receiptRepository.saveDraft(receipt);
  }, [receipt]);

  // تنظيف مؤقت المحاكاة عند إغلاق المكون
  useEffect(() => {
    return () => {
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  // إخفاء الإشعار تلقائياً
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function cancelPendingSubmit() {
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
  }

  async function handleNewReceipt() {
    cancelPendingSubmit();
    receiptRepository.clearDraft();
    const nextNumber = await receiptRepository.nextReceiptNumber();
    setReceipt(createEmptyReceipt(nextNumber));
    setActiveTab("new");
    setToast({ type: "info", message: "تم إنشاء إيصال جديد" });
  }

  function handleMockSubmit() {
    const validationError = validateReceiptForSubmission(receipt);
    if (validationError) {
      setToast({ type: "error", message: validationError });
      return;
    }

    cancelPendingSubmit();

    const submittedReceipt: Receipt = {
      ...receipt,
      submission: { status: "submitted", submittedAt: nowISO() },
    };
    setReceipt(submittedReceipt);

    setToast({
      type: "info",
      message: "جاري إرسال الإيصال لمصلحة الضرائب (محاكاة)...",
    });

    submitTimerRef.current = setTimeout(async () => {
      submitTimerRef.current = null;
      const finalReceipt: Receipt = {
        ...submittedReceipt,
        submission: {
          status: "accepted",
          submittedAt: nowISO(),
          uuid: generateUUID(),
        },
      };

      try {
        const savedReceipt = await receiptRepository.saveReceipt(finalReceipt);
        const updatedHistory = await receiptRepository.listReceipts();

        setReceipt((current) =>
          current.id === submittedReceipt.id ? savedReceipt : current
        );
        setHistory(updatedHistory);
        receiptRepository.clearDraft();

        setToast({
          type: "success",
          message:
            receiptRepository.mode === "supabase"
              ? "✅ تم قبول الإيصال وحفظه في قاعدة بيانات Supabase بنجاح!"
              : "✅ تم إرسال الإيصال وقبوله بنجاح! يمكنك الآن طباعته للعميل.",
        });
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : "تعذر حفظ الإيصال في قاعدة البيانات";
        const failedReceipt: Receipt = {
          ...submittedReceipt,
          submission: {
            status: "failed",
            submittedAt: nowISO(),
            errorMessage: errMsg,
          },
        };
        setReceipt((current) =>
          current.id === submittedReceipt.id ? failedReceipt : current
        );
        setToast({
          type: "error",
          message: `❌ فشل حفظ الإيصال: ${errMsg}`,
        });
      }
    }, 900);
  }

  function loadFromHistory(r: Receipt) {
    cancelPendingSubmit();
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
          <div className="flex items-center gap-2">
            {statusBadge}
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                title={userEmail ?? undefined}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 hover:bg-white/25 text-white transition"
              >
                تسجيل خروج
              </button>
            )}
          </div>
        </div>
      </header>

      {/* التابات */}
      <nav className="no-print bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          <button
            type="button"
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
            type="button"
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
            type="button"
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

      <main className="max-w-7xl mx-auto px-4 py-6 print-full">
        {activeTab === "new" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start print-full">
            {/* العمود الأيمن: الفورم */}
            <div className="no-print">
              <ReceiptForm receipt={receipt} setReceipt={setReceipt} />

              {/* أزرار الإجراءات */}
              <div className="mt-6 bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition flex items-center gap-2"
                >
                  🖨️ طباعة الإيصال
                </button>
                <button
                  type="button"
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
                  type="button"
                  onClick={handleNewReceipt}
                  className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
                >
                  🔄 مسح وبدء جديد
                </button>
              </div>

              {/* ملاحظة المرحلة */}
              <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-4 text-sm">
                <div className="font-bold mb-1">
                  {receiptRepository.mode === "supabase"
                    ? "☁️ وضع التشغيل: متصل بقاعدة بيانات Supabase"
                    : "💡 وضع التشغيل المحلي (لحين إضافة مفاتيح .env.local)"}
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-800 mt-2">
                  <li>
                    بيانات المكتب محفوظة في{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      src/lib/static-data.ts
                    </code>
                  </li>
                  <li>
                    {receiptRepository.mode === "supabase"
                      ? `يتم حفظ واسترجاع الإيصالات مباشرة من Supabase (${userEmail ?? "حساب المكتب"})`
                      : "الإيصالات تُحفظ حالياً في localStorage حتى تضيف مفاتيح Supabase في .env.local"}
                  </li>
                  <li>
                    زر «الإرسال للضرائب» محاكاة بدون اتصال حقيقي بمنظومة ETA بعد
                  </li>
                  <li>
                    حالة الاتصال:{" "}
                    <a
                      className="underline font-medium"
                      href="/api/supabase/status"
                      target="_blank"
                      rel="noreferrer"
                    >
                      /api/supabase/status
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* العمود الأيسر: المعاينة */}
            <div className="print-full">
              <div className="no-print mb-3 text-sm font-semibold text-slate-600 text-center">
                👁️ معاينة الإيصال (شكل الطباعة)
              </div>
              <ReceiptPreview receipt={receipt} />
            </div>
          </div>
        ) : (
          <ReceiptHistoryTable
            history={history}
            onOpenReceipt={loadFromHistory}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-slate-500">
          نظام الإيصالات الإلكترونية • مرحلة التطوير الأولى • {OFFICE_INFO.name}
        </div>
      </footer>
    </div>
  );
}
