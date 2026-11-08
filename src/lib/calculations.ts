import type { Receipt, ReceiptItem, ReceiptTotals, TaxRate } from "./types";
import { TAX_RATES } from "./static-data";

// تقريب محاسبي لأقرب قرشين لتفادي أخطاء الكسور العائمة في JavaScript
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// حساب مبالغ الصنف الواحد
export function calculateItemAmount(item: ReceiptItem): {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  total: number;
} {
  const quantity = Number.isFinite(item.quantity)
    ? Math.max(0, item.quantity)
    : 0;
  const unitPrice = Number.isFinite(item.unitPrice)
    ? Math.max(0, item.unitPrice)
    : 0;
  const discount = Number.isFinite(item.discount)
    ? Math.min(100, Math.max(0, item.discount))
    : 0;
  const taxRate = Number.isFinite(item.taxRate) ? Math.max(0, item.taxRate) : 0;

  const grossAmount = round2(quantity * unitPrice);
  const discountAmount = round2(grossAmount * (discount / 100));
  const netAmount = round2(grossAmount - discountAmount);
  const taxAmount = round2(netAmount * taxRate);
  const total = round2(netAmount + taxAmount);

  return { grossAmount, discountAmount, netAmount, taxAmount, total };
}

// حساب إجماليات الإيصال بالكامل
export function calculateTotals(
  items: ReceiptItem[],
  paidAmount?: number
): ReceiptTotals {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let total = 0;

  for (const item of items) {
    const calc = calculateItemAmount(item);
    subtotal = round2(subtotal + calc.grossAmount);
    totalDiscount = round2(totalDiscount + calc.discountAmount);
    totalTax = round2(totalTax + calc.taxAmount);
    total = round2(total + calc.total);
  }

  const safePaid =
    paidAmount !== undefined && Number.isFinite(paidAmount)
      ? round2(Math.max(0, paidAmount))
      : undefined;

  return {
    subtotal,
    totalDiscount,
    totalTax,
    total,
    paidAmount: safePaid,
    changeAmount:
      safePaid !== undefined && safePaid > total
        ? round2(safePaid - total)
        : 0,
  };
}

// بناء نص الـ QR Code بصيغة موحدة للمعاينة والطباعة
export function buildQRData(receipt: Receipt): string {
  const buyerTaxOrId =
    receipt.buyer.type === "business"
      ? receipt.buyer.taxNumber || "NA"
      : receipt.buyer.nationalId || "NA";

  return [
    "ETA_RECEIPT_V1",
    receipt.seller.taxNumber,
    receipt.receiptNumber,
    receipt.dateTime,
    receipt.totals.total.toFixed(2),
    receipt.totals.totalTax.toFixed(2),
    buyerTaxOrId,
    receipt.submission?.uuid || "DRAFT",
  ].join("|");
}

// جلب بيانات الضريبة بالكود
export function getTaxByCode(code: string): TaxRate {
  return TAX_RATES.find((t) => t.code === code) ?? TAX_RATES[0];
}

// توليد UUID متوافق مع المتصفح وقاعدة بيانات Supabase (uuid v4)
export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// التحقق من صلاحية بيانات الإيصال قبل الإرسال (متوافق مع قيود جدول Supabase)
export function validateReceiptForSubmission(receipt: Receipt): string | null {
  if (!receipt.receiptNumber.trim()) {
    return "من فضلك أدخل رقم الإيصال";
  }
  if (
    !receipt.dateTime ||
    Number.isNaN(new Date(receipt.dateTime).getTime())
  ) {
    return "من فضلك أدخل تاريخ ووقت صحيح للإيصال";
  }
  if (!receipt.buyer.name.trim()) {
    return "من فضلك أدخل اسم العميل أولاً";
  }
  if (receipt.items.length === 0) {
    return "من فضلك أضف صنفاً واحداً على الأقل";
  }
  for (let i = 0; i < receipt.items.length; i += 1) {
    const item = receipt.items[i];
    if (!item.description.trim()) {
      return `من فضلك أدخل البيان/الوصف للصنف رقم ${i + 1}`;
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return `الكمية في الصنف رقم ${i + 1} يجب أن تكون أكبر من صفر`;
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return `سعر الوحدة في الصنف رقم ${i + 1} غير صالح`;
    }
    if (
      !Number.isFinite(item.discount) ||
      item.discount < 0 ||
      item.discount > 100
    ) {
      return `نسبة الخصم في الصنف رقم ${i + 1} يجب أن تكون بين 0 و 100`;
    }
  }
  return null;
}
