import type { ReceiptItem, ReceiptTotals } from "./types";
import { TAX_RATES } from "./static-data";

// حساب إجمالي الأصناف قبل الخصم والضريبة
export function calculateItemAmount(item: ReceiptItem): {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  total: number;
} {
  const grossAmount = item.quantity * item.unitPrice;
  const discountAmount = grossAmount * (item.discount / 100);
  const netAmount = grossAmount - discountAmount;
  const taxAmount = netAmount * item.taxRate;
  const total = netAmount + taxAmount;
  return { grossAmount, discountAmount, netAmount, taxAmount, total };
}

// حساب إجماليات الإيصال كله
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
    subtotal += calc.grossAmount;
    totalDiscount += calc.discountAmount;
    totalTax += calc.taxAmount;
    total += calc.total;
  }

  return {
    subtotal,
    totalDiscount,
    totalTax,
    total,
    paidAmount,
    changeAmount: paidAmount && paidAmount > total ? paidAmount - total : 0,
  };
}

// بيانات الـ QR Code بصيغة ETA (تحتوي على: seller tax number, receipt number, datetime, total, tax total, UUID)
export function buildQRData(
  sellerTaxNumber: string,
  buyerTaxNumber: string | undefined,
  receiptNumber: string,
  dateTime: string,
  totalInclTax: number,
  totalTax: number,
  uuid?: string
): string {
  // في المراحل النهائية هيكون فيه توقيع إلكتروني، دلوقتي بيانات نصية
  return [
    "ETA_RECEIPT_V1",
    sellerTaxNumber,
    receiptNumber,
    dateTime,
    totalInclTax.toFixed(2),
    totalTax.toFixed(2),
    buyerTaxNumber || "NA",
    uuid || "NOT_SUBMITTED",
  ].join("|");
}

// جلب اسم الضريبة بالكود
export function getTaxByCode(code: string) {
  return TAX_RATES.find((t) => t.code === code) ?? TAX_RATES[0];
}

// توليد UUID وهمي للمحاكاة
export function mockUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
