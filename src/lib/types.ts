// أنواع البيانات الأساسية لنظام الإيصالات الإلكترونية

export type ReceiptType =
  | "cash" // نقدي
  | "credit" // آجل
  | "return_cash" // مرتجع نقدي
  | "return_credit"; // مرتجع آجل

export type PaymentMethod =
  | "cash" // نقدية
  | "card" // بطاقة
  | "bank_transfer" // تحويل بنكي
  | "check"; // شيك

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected"
  | "failed";

export interface TaxRate {
  code: string; // كود الضريبة
  name: string;
  shortLabel: string; // اسم مختصر للطباعة
  rate: number; // النسبة العشرية (مثال: 0.14)
}

export interface SellerInfo {
  name: string;
  taxNumber: string; // رقم التسجيل الضريبي
  commercialRegister?: string;
  address: string;
  governorate: string;
  branchCode: string; // كود الفرع
  deviceSerialNo: string; // الرقم المسلسل للجهاز
  syndicateNumber?: string; // رقم القيد بالنقابة (للمحاسبين)
  phone?: string;
  email?: string;
}

export interface BuyerInfo {
  name: string;
  taxNumber?: string; // رقم التسجيل الضريبي (اختياري للأفراد)
  nationalId?: string; // الرقم القومي
  address?: string;
  phone?: string;
  type: "business" | "person"; // شركة أم فرد
}

export interface ReceiptItem {
  id: string;
  description: string; // البيان / الوصف
  itemCode?: string; // كود الصنف
  unit: string; // الوحدة (عدد، خدمة، إلخ)
  quantity: number;
  unitPrice: number;
  taxCode: string; // كود الضريبة
  taxRate: number;
  discount: number; // خصم على الصنف (نسبة 0 - 100)
}

export interface ReceiptTotals {
  subtotal: number; // إجمالي قبل الخصم والضريبة
  totalDiscount: number;
  totalTax: number;
  total: number;
  paidAmount?: number;
  changeAmount?: number;
}

export interface ReceiptSubmission {
  uuid?: string; // UUID من مصلحة الضرائب
  status: SubmissionStatus;
  submittedAt?: string;
  errorMessage?: string;
}

export interface Receipt {
  id?: string;
  receiptNumber: string;
  receiptType: ReceiptType;
  dateTime: string; // ISO 8601
  seller: SellerInfo;
  buyer: BuyerInfo;
  items: ReceiptItem[];
  paymentMethod: PaymentMethod;
  totals: ReceiptTotals;
  notes?: string;
  submission?: ReceiptSubmission;
}
