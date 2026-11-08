import type {
  BuyerInfo,
  PaymentMethod,
  Receipt,
  ReceiptItem,
  ReceiptType,
  SellerInfo,
  SubmissionStatus,
} from "./types";
import { calculateTotals, generateUUID, getTaxByCode } from "./calculations";
import { OFFICE_INFO } from "./static-data";

// أنواع الصفوف المطابقة لجدولي public.receipts و public.receipt_items في Supabase
export interface DbReceiptRow {
  id: string;
  receipt_number: string;
  receipt_type: ReceiptType;
  issued_at: string;
  seller: SellerInfo;
  buyer: BuyerInfo;
  payment_method: PaymentMethod;
  subtotal: number | string;
  total_discount: number | string;
  total_tax: number | string;
  grand_total: number | string;
  paid_amount: number | string | null;
  notes: string | null;
  submission_status: SubmissionStatus;
  eta_uuid: string | null;
  submitted_at: string | null;
  submission_error: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbReceiptItemRow {
  id?: string;
  receipt_id: string;
  line_number: number;
  description: string;
  item_code: string | null;
  unit: string;
  quantity: number | string;
  unit_price: number | string;
  tax_code: string;
  tax_rate: number | string;
  discount_rate: number | string;
  created_at?: string;
}

export interface SaveReceiptRpcResult {
  receipt: DbReceiptRow;
  items: DbReceiptItemRow[];
}

/**
 * تحويل نموذج الإيصال في التطبيق إلى معاملات دالة save_receipt_with_items في Supabase.
 */
export function mapReceiptToDbPayload(receipt: Receipt): {
  receiptRow: DbReceiptRow;
  itemRows: DbReceiptItemRow[];
} {
  const receiptId = receipt.id || generateUUID();
  const totals = calculateTotals(receipt.items, receipt.totals.paidAmount);

  const receiptRow: DbReceiptRow = {
    id: receiptId,
    receipt_number: receipt.receiptNumber.trim(),
    receipt_type: receipt.receiptType,
    issued_at: receipt.dateTime,
    seller: receipt.seller,
    buyer: receipt.buyer,
    payment_method: receipt.paymentMethod,
    subtotal: totals.subtotal,
    total_discount: totals.totalDiscount,
    total_tax: totals.totalTax,
    grand_total: totals.total,
    paid_amount: totals.paidAmount ?? null,
    notes: receipt.notes?.trim() || null,
    submission_status: receipt.submission?.status ?? "draft",
    eta_uuid: receipt.submission?.uuid ?? null,
    submitted_at: receipt.submission?.submittedAt ?? null,
    submission_error: receipt.submission?.errorMessage ?? null,
  };

  const itemRows: DbReceiptItemRow[] = receipt.items.map((item, idx) => ({
    id: item.id || generateUUID(),
    receipt_id: receiptId,
    line_number: idx + 1,
    description: item.description.trim(),
    item_code: item.itemCode?.trim() || null,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    tax_code: item.taxCode,
    tax_rate: item.taxRate,
    discount_rate: item.discount,
  }));

  return { receiptRow, itemRows };
}

/**
 * تحويل صفوف قاعدة بيانات Supabase إلى نموذج الإيصال المستخدم في الواجهة.
 */
export function mapDbRowsToReceipt(
  row: DbReceiptRow,
  itemRows: DbReceiptItemRow[]
): Receipt {
  const sortedItems = [...itemRows].sort(
    (a, b) => a.line_number - b.line_number
  );

  const items: ReceiptItem[] = sortedItems.map((it) => {
    const tax = getTaxByCode(it.tax_code);
    return {
      id: it.id || generateUUID(),
      description: it.description,
      itemCode: it.item_code ?? "",
      unit: it.unit,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      taxCode: tax.code,
      taxRate: Number(it.tax_rate ?? tax.rate),
      discount: Number(it.discount_rate ?? 0),
    };
  });

  const paidAmount =
    row.paid_amount !== null && row.paid_amount !== undefined
      ? Number(row.paid_amount)
      : undefined;

  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    receiptType: row.receipt_type,
    dateTime: row.issued_at,
    seller: row.seller ?? OFFICE_INFO,
    buyer: row.buyer,
    items,
    paymentMethod: row.payment_method,
    totals: calculateTotals(items, paidAmount),
    notes: row.notes ?? "",
    submission: {
      status: row.submission_status,
      uuid: row.eta_uuid ?? undefined,
      submittedAt: row.submitted_at ?? undefined,
      errorMessage: row.submission_error ?? undefined,
    },
  };
}
