"use client";

import type { ReactNode } from "react";
import type {
  Receipt,
  ReceiptItem,
  ReceiptType,
  PaymentMethod,
} from "@/lib/types";
import {
  RECEIPT_TYPES,
  PAYMENT_METHODS,
  TAX_RATES,
  UNIT_OPTIONS,
  formatNum,
} from "@/lib/static-data";
import { calculateTotals, getTaxByCode } from "@/lib/calculations";
import { createEmptyItem } from "@/lib/receipt-repository";

export { createEmptyItem };

interface Props {
  receipt: Receipt;
  setReceipt: (r: Receipt) => void;
}

export default function ReceiptForm({ receipt, setReceipt }: Props) {
  const status = receipt.submission?.status ?? "draft";
  const isLocked = status === "accepted" || status === "submitted";

  function updateReceipt(patch: Partial<Receipt>) {
    if (isLocked) return;
    setReceipt({ ...receipt, ...patch });
  }

  function updateBuyer(patch: Partial<Receipt["buyer"]>) {
    if (isLocked) return;
    const nextBuyer = { ...receipt.buyer, ...patch };
    if (patch.type === "person") {
      nextBuyer.taxNumber = "";
    } else if (patch.type === "business") {
      nextBuyer.nationalId = "";
    }
    setReceipt({ ...receipt, buyer: nextBuyer });
  }

  function updateItem(id: string, patch: Partial<ReceiptItem>) {
    if (isLocked) return;
    const newItems = receipt.items.map((it) => {
      if (it.id !== id) return it;
      const updated = { ...it, ...patch };
      if (patch.taxCode) {
        const tax = getTaxByCode(patch.taxCode);
        updated.taxCode = tax.code;
        updated.taxRate = tax.rate;
      }
      return updated;
    });

    const totals = calculateTotals(newItems, receipt.totals.paidAmount);
    setReceipt({ ...receipt, items: newItems, totals });
  }

  function addItem() {
    if (isLocked) return;
    const newItems = [...receipt.items, createEmptyItem()];
    setReceipt({
      ...receipt,
      items: newItems,
      totals: calculateTotals(newItems, receipt.totals.paidAmount),
    });
  }

  function removeItem(id: string) {
    if (isLocked) return;
    const newItems = receipt.items.filter((it) => it.id !== id);
    setReceipt({
      ...receipt,
      items: newItems,
      totals: calculateTotals(newItems, receipt.totals.paidAmount),
    });
  }

  function updatePaid(value: number | undefined) {
    if (isLocked) return;
    setReceipt({
      ...receipt,
      totals: calculateTotals(receipt.items, value),
    });
  }

  return (
    <fieldset disabled={isLocked} className="space-y-6 disabled:opacity-80">
      {/* نوع الإيصال وطريقة الدفع */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-4 text-[var(--brand)]">
          بيانات الإيصال
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="نوع الإيصال">
            <select
              value={receipt.receiptType}
              onChange={(e) =>
                updateReceipt({
                  receiptType: e.target.value as ReceiptType,
                })
              }
              className="form-input"
            >
              {RECEIPT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="طريقة الدفع">
            <select
              value={receipt.paymentMethod}
              onChange={(e) =>
                updateReceipt({
                  paymentMethod: e.target.value as PaymentMethod,
                })
              }
              className="form-input"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="رقم الإيصال">
            <input
              type="text"
              value={receipt.receiptNumber}
              onChange={(e) => updateReceipt({ receiptNumber: e.target.value })}
              className="form-input"
              dir="ltr"
            />
          </Field>

          <Field label="تاريخ ووقت الإيصال">
            <input
              type="datetime-local"
              value={toLocalInput(receipt.dateTime)}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const parsed = new Date(val);
                if (Number.isNaN(parsed.getTime())) return;
                updateReceipt({ dateTime: parsed.toISOString() });
              }}
              className="form-input"
              dir="ltr"
            />
          </Field>
        </div>
      </section>

      {/* بيانات العميل */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-4 text-[var(--brand)]">
          بيانات العميل
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="نوع العميل">
            <select
              value={receipt.buyer.type}
              onChange={(e) =>
                updateBuyer({
                  type: e.target.value as "business" | "person",
                })
              }
              className="form-input"
            >
              <option value="business">شركة / منشأة</option>
              <option value="person">فرد</option>
            </select>
          </Field>

          <Field label="اسم العميل *" className="md:col-span-2">
            <input
              type="text"
              value={receipt.buyer.name}
              onChange={(e) => updateBuyer({ name: e.target.value })}
              placeholder="اسم العميل أو الشركة"
              className="form-input"
            />
          </Field>

          {receipt.buyer.type === "business" ? (
            <Field label="رقم التسجيل الضريبي">
              <input
                type="text"
                value={receipt.buyer.taxNumber ?? ""}
                onChange={(e) => updateBuyer({ taxNumber: e.target.value })}
                placeholder="000-000-000"
                className="form-input"
                dir="ltr"
              />
            </Field>
          ) : (
            <Field label="الرقم القومي">
              <input
                type="text"
                inputMode="numeric"
                value={receipt.buyer.nationalId ?? ""}
                onChange={(e) =>
                  updateBuyer({
                    nationalId: e.target.value.replace(/\D/g, "").slice(0, 14),
                  })
                }
                placeholder="14 رقم"
                className="form-input"
                dir="ltr"
                maxLength={14}
              />
            </Field>
          )}

          <Field label="رقم التليفون">
            <input
              type="text"
              value={receipt.buyer.phone ?? ""}
              onChange={(e) => updateBuyer({ phone: e.target.value })}
              className="form-input"
              dir="ltr"
            />
          </Field>

          <Field label="العنوان" className="md:col-span-2 lg:col-span-3">
            <input
              type="text"
              value={receipt.buyer.address ?? ""}
              onChange={(e) => updateBuyer({ address: e.target.value })}
              placeholder="عنوان العميل (اختياري)"
              className="form-input"
            />
          </Field>
        </div>
      </section>

      {/* الأصناف */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-[var(--brand)]">
            الأصناف / الخدمات
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="px-4 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-dark)] transition disabled:opacity-50"
          >
            + إضافة صنف
          </button>
        </div>

        <div className="space-y-4">
          {receipt.items.length === 0 && (
            <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
              لا توجد أصناف بعد. اضغط «إضافة صنف» للبدء.
            </div>
          )}

          {receipt.items.map((item, idx) => (
            <div
              key={item.id}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold text-sm text-slate-700">
                  صنف {idx + 1}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                >
                  حذف
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field
                  label="البيان / الوصف *"
                  className="md:col-span-2 lg:col-span-3"
                >
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.id, { description: e.target.value })
                    }
                    placeholder="مثال: مراجعة حسابات شهر يناير 2026"
                    className="form-input"
                  />
                </Field>

                <Field label="كود الصنف">
                  <input
                    type="text"
                    value={item.itemCode ?? ""}
                    onChange={(e) =>
                      updateItem(item.id, { itemCode: e.target.value })
                    }
                    className="form-input"
                    dir="ltr"
                  />
                </Field>

                <Field label="الوحدة">
                  <select
                    value={item.unit}
                    onChange={(e) =>
                      updateItem(item.id, { unit: e.target.value })
                    }
                    className="form-input"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="نوع الضريبة">
                  <select
                    value={item.taxCode}
                    onChange={(e) =>
                      updateItem(item.id, { taxCode: e.target.value })
                    }
                    className="form-input text-xs"
                  >
                    {TAX_RATES.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="الكمية">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateItem(item.id, {
                        quantity: Number.isFinite(val) ? Math.max(0, val) : 0,
                      });
                    }}
                    className="form-input"
                  />
                </Field>

                <Field label="سعر الوحدة (ج.م)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateItem(item.id, {
                        unitPrice: Number.isFinite(val) ? Math.max(0, val) : 0,
                      });
                    }}
                    className="form-input"
                  />
                </Field>

                <Field label="نسبة الخصم (%)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={item.discount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateItem(item.id, {
                        discount: Number.isFinite(val)
                          ? Math.min(100, Math.max(0, val))
                          : 0,
                      });
                    }}
                    className="form-input"
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* الإجماليات */}
      <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-4 text-[var(--brand)]">
          الإجماليات والدفع
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Field label="المبلغ المدفوع (ج.م)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={receipt.totals.paidAmount ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    updatePaid(undefined);
                  } else {
                    const num = parseFloat(v);
                    updatePaid(Number.isFinite(num) ? Math.max(0, num) : 0);
                  }
                }}
                placeholder="اتركه فارغاً لو لم يدفع بعد"
                className="form-input"
              />
            </Field>
            <Field label="ملاحظات">
              <textarea
                value={receipt.notes ?? ""}
                onChange={(e) => updateReceipt({ notes: e.target.value })}
                rows={3}
                className="form-input resize-none"
                placeholder="أي ملاحظات على الإيصال (اختياري)"
              />
            </Field>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">إجمالي الأصناف:</span>
              <span className="font-semibold" dir="ltr">
                {formatNum(receipt.totals.subtotal)} ج.م
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">إجمالي الخصم:</span>
              <span className="font-semibold text-red-600" dir="ltr">
                - {formatNum(receipt.totals.totalDiscount)} ج.م
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">إجمالي الضرائب:</span>
              <span className="font-semibold" dir="ltr">
                {formatNum(receipt.totals.totalTax)} ج.م
              </span>
            </div>
            <div className="border-t border-slate-300 pt-2 flex justify-between text-base font-bold">
              <span>الإجمالي النهائي:</span>
              <span className="text-[var(--brand)]" dir="ltr">
                {formatNum(receipt.totals.total)} ج.م
              </span>
            </div>
            {receipt.totals.paidAmount != null && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">الباقي للعميل:</span>
                <span className="font-semibold text-green-700" dir="ltr">
                  {formatNum(receipt.totals.changeAmount ?? 0)} ج.م
                </span>
              </div>
            )}
          </div>
        </div>
      </section>
    </fieldset>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="text-sm font-medium text-slate-700 mb-1">{label}</div>
      {children}
    </label>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}
