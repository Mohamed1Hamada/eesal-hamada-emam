"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { Receipt } from "@/lib/types";
import { formatEGP } from "@/lib/static-data";
import { calculateItemAmount } from "@/lib/calculations";

interface Props {
  receipt: Receipt;
}

// نوع الإيصال بالعربي
const RECEIPT_TYPE_LABELS: Record<string, string> = {
  cash: "إيصال نقدي",
  credit: "إيصال آجل",
  return_cash: "مرتجع نقدي",
  return_credit: "مرتجع آجل",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة إلكترونية",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
};

export default function ReceiptPreview({ receipt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrText, setQrText] = useState("");

  useEffect(() => {
    if (!canvasRef.current) return;
    // بناء نص الـ QR بنفس الصيغة المطلوبة
    const qrRaw = [
      "ETA",
      receipt.seller.taxNumber,
      receipt.receiptNumber,
      receipt.dateTime,
      receipt.totals.total.toFixed(2),
      receipt.totals.totalTax.toFixed(2),
      receipt.submission?.uuid || "DRAFT",
    ].join("|");
    setQrText(qrRaw);
    QRCode.toCanvas(
      canvasRef.current,
      qrRaw,
      { width: 160, margin: 1, color: { dark: "#000000", light: "#ffffff" } },
      (err) => {
        if (err) console.error(err);
      }
    );
  }, [receipt]);

  const dateFormatted = new Date(receipt.dateTime).toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="receipt-print receipt-shadow mx-auto bg-white w-full max-w-[80mm] rounded-lg border border-slate-200 p-4 font-mono text-[11px] leading-tight text-slate-900"
      dir="rtl"
    >
      {/* ترويسة الإيصال */}
      <div className="text-center mb-2">
        <div className="flex justify-center mb-1">
          <div className="w-14 h-14 rounded-full bg-[var(--brand)] flex items-center justify-center text-white font-bold text-lg">
            {receipt.seller.name.charAt(0)}
          </div>
        </div>
        <div className="font-bold text-sm">{receipt.seller.name}</div>
        <div className="text-[10px] text-slate-600 mt-0.5">
          رقم التسجيل الضريبي: {receipt.seller.taxNumber}
        </div>
        {receipt.seller.commercialRegister && (
          <div className="text-[10px] text-slate-600">
            س.ت: {receipt.seller.commercialRegister}
          </div>
        )}
        {receipt.seller.syndicateNumber && (
          <div className="text-[10px] text-slate-600">
            رقم قيد النقابة: {receipt.seller.syndicateNumber}
          </div>
        )}
        <div className="text-[10px] text-slate-600 mt-0.5">
          العنوان: {receipt.seller.address}
        </div>
        {receipt.seller.phone && (
          <div className="text-[10px] text-slate-600">
            تليفون: {receipt.seller.phone}
          </div>
        )}
      </div>

      <div className="receipt-dashed my-2"></div>

      {/* بيانات الإيصال */}
      <div className="grid grid-cols-2 gap-y-1 mb-2">
        <div>
          <span className="text-slate-500">نوع الإيصال:</span>{" "}
          <span className="font-semibold">
            {RECEIPT_TYPE_LABELS[receipt.receiptType]}
          </span>
        </div>
        <div>
          <span className="text-slate-500">طريقة الدفع:</span>{" "}
          <span className="font-semibold">
            {PAYMENT_LABELS[receipt.paymentMethod]}
          </span>
        </div>
        <div className="col-span-2">
          <span className="text-slate-500">رقم الإيصال:</span>{" "}
          <span className="font-semibold">{receipt.receiptNumber}</span>
        </div>
        <div className="col-span-2">
          <span className="text-slate-500">التاريخ:</span>{" "}
          <span className="font-semibold">{dateFormatted}</span>
        </div>
        <div>
          <span className="text-slate-500">الفرع:</span>{" "}
          <span>{receipt.seller.branchCode}</span>
        </div>
        <div>
          <span className="text-slate-500">الجهاز:</span>{" "}
          <span>{receipt.seller.deviceSerialNo}</span>
        </div>
      </div>

      <div className="receipt-dashed my-2"></div>

      {/* بيانات العميل */}
      <div className="mb-2">
        <div className="font-bold mb-1">بيانات العميل</div>
        <div>
          <span className="text-slate-500">الاسم:</span>{" "}
          <span className="font-semibold">{receipt.buyer.name}</span>
        </div>
        {receipt.buyer.taxNumber && (
          <div>
            <span className="text-slate-500">رقم التسجيل:</span>{" "}
            <span>{receipt.buyer.taxNumber}</span>
          </div>
        )}
        {receipt.buyer.nationalId && !receipt.buyer.taxNumber && (
          <div>
            <span className="text-slate-500">الرقم القومي:</span>{" "}
            <span>{receipt.buyer.nationalId}</span>
          </div>
        )}
        {receipt.buyer.address && (
          <div>
            <span className="text-slate-500">العنوان:</span>{" "}
            <span>{receipt.buyer.address}</span>
          </div>
        )}
        {receipt.buyer.phone && (
          <div>
            <span className="text-slate-500">التليفون:</span>{" "}
            <span>{receipt.buyer.phone}</span>
          </div>
        )}
      </div>

      <div className="receipt-dashed my-2"></div>

      {/* جدول الأصناف */}
      <div className="mb-2">
        <div className="grid grid-cols-12 gap-0.5 font-bold text-[10px] border-b border-slate-300 pb-1 mb-1">
          <div className="col-span-6">البيان</div>
          <div className="col-span-2 text-center">كمية</div>
          <div className="col-span-2 text-center">سعر</div>
          <div className="col-span-2 text-left">إجمالي</div>
        </div>
        {receipt.items.map((item, idx) => {
          const calc = calculateItemAmount(item);
          return (
            <div key={item.id} className="mb-1.5">
              <div className="grid grid-cols-12 gap-0.5 text-[10px]">
                <div className="col-span-6">{item.description}</div>
                <div className="col-span-2 text-center">{item.quantity}</div>
                <div className="col-span-2 text-center">
                  {item.unitPrice.toFixed(2)}
                </div>
                <div className="col-span-2 text-left">
                  {calc.netAmount.toFixed(2)}
                </div>
              </div>
              <div className="grid grid-cols-12 gap-0.5 text-[9px] text-slate-500">
                <div className="col-span-8">
                  {item.taxRate > 0
                    ? `ض.ق.م ${(item.taxRate * 100).toFixed(0)}%`
                    : "غير خاضع / معفي"}
                  {item.discount > 0 && ` • خصم ${item.discount}%`}
                </div>
                <div className="col-span-4 text-left">
                  ض. {calc.taxAmount.toFixed(2)}
                </div>
              </div>
              {idx < receipt.items.length - 1 && (
                <div className="border-b border-dotted border-slate-200 my-1"></div>
              )}
            </div>
          );
        })}
      </div>

      <div className="receipt-dashed my-2"></div>

      {/* الإجماليات */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between">
          <span>إجمالي الأصناف:</span>
          <span>{formatEGP(receipt.totals.subtotal)}</span>
        </div>
        {receipt.totals.totalDiscount > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>إجمالي الخصم:</span>
            <span>- {formatEGP(receipt.totals.totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>إجمالي الضرائب:</span>
          <span>{formatEGP(receipt.totals.totalTax)}</span>
        </div>
        <div className="flex justify-between font-bold text-base border-t border-slate-400 pt-1 mt-1">
          <span>الإجمالي المطلوب:</span>
          <span>{formatEGP(receipt.totals.total)}</span>
        </div>
        {receipt.totals.paidAmount != null && (
          <>
            <div className="flex justify-between">
              <span>المدفوع:</span>
              <span>{formatEGP(receipt.totals.paidAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>الباقي:</span>
              <span>
                {formatEGP(
                  Math.max(0, receipt.totals.paidAmount - receipt.totals.total)
                )}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="receipt-dashed my-2"></div>

      {/* QR Code */}
      <div className="flex justify-center my-3">
        <canvas ref={canvasRef} />
      </div>

      {/* حالة الإرسال */}
      {receipt.submission && (
        <div
          className={`text-center text-[10px] py-1 rounded ${
            receipt.submission.status === "accepted"
              ? "bg-green-100 text-green-800"
              : receipt.submission.status === "rejected"
              ? "bg-red-100 text-red-800"
              : receipt.submission.status === "submitted"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {receipt.submission.status === "accepted" && (
            <>
              ✓ تم إرسال الإيصال وقبوله
              <br />
              UUID: {receipt.submission.uuid}
            </>
          )}
          {receipt.submission.status === "submitted" &&
            "⏳ جاري إرسال الإيصال..."}
          {receipt.submission.status === "rejected" &&
            `✗ مرفوض: ${receipt.submission.errorMessage}`}
          {receipt.submission.status === "draft" && "⚠️ مسودة - لم يتم الإرسال بعد"}
          {receipt.submission.status === "failed" &&
            `✗ فشل الإرسال: ${receipt.submission.errorMessage}`}
        </div>
      )}

      {/* ملاحظات */}
      {receipt.notes && (
        <>
          <div className="receipt-dashed my-2"></div>
          <div className="text-[10px]">
            <span className="font-semibold">ملاحظات:</span> {receipt.notes}
          </div>
        </>
      )}

      <div className="receipt-dashed my-2"></div>

      {/* التوقيع */}
      <div className="text-center text-[10px] mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="border-b border-slate-400 h-8"></div>
          <div className="mt-1">توقيع المحصل</div>
        </div>
        <div>
          <div className="border-b border-slate-400 h-8"></div>
          <div className="mt-1">توقيع المستلم</div>
        </div>
      </div>

      <div className="text-center text-[9px] text-slate-500 mt-3">
        {receipt.seller.name} - نظام الإيصالات الإلكترونية
        <br />
        شكراً لتعاملكم معنا
      </div>
    </div>
  );
}
