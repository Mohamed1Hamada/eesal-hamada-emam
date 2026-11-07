import type { SellerInfo, TaxRate, ReceiptType, PaymentMethod } from "./types";

// ============================================
// ⚠️  بيانات المكتب - غيرها بيانات مكتبك الحقيقية
// ============================================
export const OFFICE_INFO: SellerInfo = {
  name: "مكتب حماده امام عبد الفتاح",
  taxNumber: "000-000-000", // رقم التسجيل الضريبي للمكتب
  commercialRegister: "00000", // رقم السجل التجاري
  address: "القاهرة - [عنوان المكتب]",
  governorate: "القاهرة",
  branchCode: "0", // كود الفرع الرئيسي
  deviceSerialNo: "DEVICE001", // الرقم المسلسل للجهاز/الإصدار
  syndicateNumber: "00000", // رقم قيد النقابة
  phone: "02-00000000",
  email: "info@office-eta.eg",
};

// ============================================
//  الضرائب اللي بنستخدمها في المحاسبة القانونية
// ============================================
export const TAX_RATES: TaxRate[] = [
  { code: "1", name: "ضريبة القيمة المضافة (14%)", rate: 0.14 },
  { code: "2", name: "ضريبة القيمة المضافة (0%) تصدير", rate: 0 },
  { code: "3", name: "ضريبة جدولية (1%)", rate: 0.01 },
  { code: "4", name: "غير خاضع للضريبة", rate: 0 },
  { code: "5", name: "معفي من الضريبة", rate: 0 },
];

// أنواع الإيصالات
export const RECEIPT_TYPES: { value: ReceiptType; label: string }[] = [
  { value: "cash", label: "إيصال نقدي" },
  { value: "credit", label: "إيصال آجل" },
  { value: "return_cash", label: "مرتجع نقدي" },
  { value: "return_credit", label: "مرتجع آجل" },
];

// طرق الدفع
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة إلكترونية" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "check", label: "شيك" },
];

// الوحدات الافتراضية
export const UNIT_OPTIONS = ["خدمة", "عدد", "م", "كجم", "علبة", "كيلو", "يوم", "ساعة"];

// تنسيق الأرقام بالعربي/الإنجليزي
export function formatEGP(amount: number): string {
  return new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " ج.م";
}

// رقم إيصال افتراضي
export function generateReceiptNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 9000) + 1000);
  return `R-${y}${m}${d}-${random}`;
}

// وقت حالي ISO
export function nowISO(): string {
  return new Date().toISOString();
}
