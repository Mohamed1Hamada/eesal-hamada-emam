import type { Receipt, ReceiptItem } from "./types";
import {
  OFFICE_INFO,
  TAX_RATES,
  generateReceiptNumber,
  nowISO,
} from "./static-data";
import { calculateTotals, generateUUID, getTaxByCode } from "./calculations";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "./supabase";
import {
  type DbReceiptItemRow,
  type DbReceiptRow,
  type SaveReceiptRpcResult,
  mapDbRowsToReceipt,
  mapReceiptToDbPayload,
} from "./supabase-mappers";

const DRAFT_KEY = "eta-receipt-draft";
const HISTORY_KEY = "eta-receipt-history";
const MAX_LOCAL_HISTORY = 50;

// إنشاء صنف جديد فارغ
export function createEmptyItem(): ReceiptItem {
  const defaultTax = TAX_RATES[0];
  return {
    id: generateUUID(),
    description: "",
    itemCode: "",
    unit: "خدمة",
    quantity: 1,
    unitPrice: 0,
    taxCode: defaultTax.code,
    taxRate: defaultTax.rate,
    discount: 0,
  };
}

// إنشاء إيصال جديد بالبيانات الافتراضية
export function createEmptyReceipt(customReceiptNumber?: string): Receipt {
  const items: ReceiptItem[] = [
    {
      ...createEmptyItem(),
      description: "خدمات محاسبية ومراجعة",
      unitPrice: 1000,
      quantity: 1,
    },
  ];

  return {
    id: generateUUID(),
    receiptNumber: customReceiptNumber || generateReceiptNumber(),
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

// تنظيف وتوحيد بيانات أي إيصال مقروء من التخزين المحلي
export function normalizeStoredReceipt(raw: Partial<Receipt>): Receipt {
  const items: ReceiptItem[] = Array.isArray(raw.items)
    ? raw.items.map((it) => {
        const tax = getTaxByCode(it.taxCode ?? TAX_RATES[0].code);
        return {
          id: it.id || generateUUID(),
          description: it.description ?? "",
          itemCode: it.itemCode ?? "",
          unit: it.unit || "خدمة",
          quantity: Number.isFinite(it.quantity) ? it.quantity : 1,
          unitPrice: Number.isFinite(it.unitPrice) ? it.unitPrice : 0,
          taxCode: tax.code,
          taxRate: tax.rate,
          discount: Number.isFinite(it.discount) ? it.discount : 0,
        };
      })
    : [];

  const buyerType = raw.buyer?.type === "business" ? "business" : "person";
  const status = raw.submission?.status ?? "draft";

  return {
    id: raw.id || generateUUID(),
    receiptNumber: raw.receiptNumber || generateReceiptNumber(),
    receiptType: raw.receiptType ?? "cash",
    dateTime:
      raw.dateTime && !Number.isNaN(new Date(raw.dateTime).getTime())
        ? raw.dateTime
        : nowISO(),
    seller: status === "draft" ? OFFICE_INFO : raw.seller ?? OFFICE_INFO,
    buyer: {
      name: raw.buyer?.name ?? "",
      type: buyerType,
      taxNumber: buyerType === "business" ? raw.buyer?.taxNumber ?? "" : "",
      nationalId: buyerType === "person" ? raw.buyer?.nationalId ?? "" : "",
      address: raw.buyer?.address ?? "",
      phone: raw.buyer?.phone ?? "",
    },
    items,
    paymentMethod: raw.paymentMethod ?? "cash",
    totals: calculateTotals(items, raw.totals?.paidAmount),
    notes: raw.notes ?? "",
    submission: {
      status,
      uuid: raw.submission?.uuid,
      submittedAt: raw.submission?.submittedAt,
      errorMessage: raw.submission?.errorMessage,
    },
  };
}

// ============================================
// واجهة موحدة للتخزين (تعمل تلقائياً مع Supabase عند ضبط .env.local أو محلياً بدونه)
// ============================================
export interface ReceiptRepository {
  readonly mode: "local" | "supabase";
  loadDraft(): Receipt | null;
  saveDraft(receipt: Receipt): void;
  clearDraft(): void;
  nextReceiptNumber(): Promise<string>;
  listReceipts(): Promise<Receipt[]>;
  saveReceipt(receipt: Receipt): Promise<Receipt>;
}

// 1) مخزن المتصفح المحلي (للتجربة بدون إعدادات Supabase)
export const localReceiptRepository: ReceiptRepository = {
  mode: "local",

  loadDraft(): Receipt | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Receipt>;
      if ((parsed.submission?.status ?? "draft") !== "draft") return null;
      return normalizeStoredReceipt(parsed);
    } catch {
      return null;
    }
  },

  saveDraft(receipt: Receipt): void {
    if (typeof window === "undefined") return;
    try {
      if ((receipt.submission?.status ?? "draft") === "draft") {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(receipt));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {}
  },

  clearDraft(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  },

  async nextReceiptNumber(): Promise<string> {
    return generateReceiptNumber();
  },

  async listReceipts(): Promise<Receipt[]> {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Partial<Receipt>[];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeStoredReceipt);
    } catch {
      return [];
    }
  },

  async saveReceipt(receipt: Receipt): Promise<Receipt> {
    const normalized = normalizeStoredReceipt(receipt);
    if (typeof window !== "undefined") {
      try {
        const current = await this.listReceipts();
        const filtered = current.filter(
          (r) =>
            r.id !== normalized.id &&
            r.receiptNumber !== normalized.receiptNumber
        );
        const updated = [normalized, ...filtered].slice(0, MAX_LOCAL_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {}
    }
    return normalized;
  },
};

// 2) مخزن Supabase السحابي (يعمل تلقائياً فور ضبط مفاتيح .env.local وتسجيل الدخول)
export const supabaseReceiptRepository: ReceiptRepository = {
  mode: "supabase",

  loadDraft: () => localReceiptRepository.loadDraft(),
  saveDraft: (receipt) => localReceiptRepository.saveDraft(receipt),
  clearDraft: () => localReceiptRepository.clearDraft(),

  async nextReceiptNumber(): Promise<string> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return generateReceiptNumber();

    const { data, error } = await supabase.rpc("next_eesal_receipt_number");
    if (error || typeof data !== "string" || !data.trim()) {
      return generateReceiptNumber();
    }
    return data;
  },

  async listReceipts(): Promise<Receipt[]> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("إعدادات Supabase غير مكتملة");
    }

    const { data: receiptsData, error: receiptsError } = await supabase
      .from("receipts")
      .select("*")
      .order("issued_at", { ascending: false })
      .limit(100);

    if (receiptsError) throw receiptsError;
    const rows = (receiptsData ?? []) as DbReceiptRow[];
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const { data: itemsData, error: itemsError } = await supabase
      .from("receipt_items")
      .select("*")
      .in("receipt_id", ids)
      .order("line_number", { ascending: true });

    if (itemsError) throw itemsError;
    const allItems = (itemsData ?? []) as DbReceiptItemRow[];

    return rows.map((row) =>
      mapDbRowsToReceipt(
        row,
        allItems.filter((item) => item.receipt_id === row.id)
      )
    );
  },

  async saveReceipt(receipt: Receipt): Promise<Receipt> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("إعدادات Supabase غير مكتملة");
    }

    const { receiptRow, itemRows } = mapReceiptToDbPayload(receipt);

    // حفظ الإيصال وبنوده معاً في معاملة واحدة (Atomic Transaction) عبر دالة الـ RPC
    const { data, error } = await supabase.rpc("save_receipt_with_items", {
      p_receipt: receiptRow,
      p_items: itemRows,
    });

    if (error) throw error;

    const result = data as SaveReceiptRpcResult;
    return mapDbRowsToReceipt(result.receipt, result.items ?? []);
  },
};

// يختار تلقائياً Supabase إذا تم ضبط متغيرات البيئة، وإلا يستخدم localStorage للتجربة
export const receiptRepository: ReceiptRepository = isSupabaseConfigured()
  ? supabaseReceiptRepository
  : localReceiptRepository;
