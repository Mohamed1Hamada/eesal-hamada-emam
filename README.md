# eesal-hamada-emam

النسخة الأولية النظيفة لنظام الإيصالات الإلكترونية الخاص بـ **مكتب حماده امام عبد الفتاح**، مجهزة بالكامل للربط مع **Supabase**.

## هيكلة المشروع

- `src/lib/types.ts` — تعريفات الأنواع الأساسية للإيصال والأصناف والضرائب.
- `src/lib/static-data.ts` — بيانات المكتب الثابتة وقوائم الضرائب وطرق الدفع.
- `src/lib/calculations.ts` — الحسابات المحاسبية المقربة لأقرب قرشين والتحقق وبناء الـ QR Code.
- `src/lib/supabase.ts` — تهيئة عميل Supabase للسيرفر والمتصفح.
- `src/lib/supabase-mappers.ts` — التحويل المباشر بين نموذج التطبيق وجدولي `receipts` و `receipt_items`.
- `src/lib/receipt-repository.ts` — طبقة تخزين موحدة (`localStorage` حالياً + `Supabase` جاهزة للتفعيل بسطر واحد بعد إضافة تسجيل الدخول).
- `supabase/migrations/` — ملف SQL لإنشاء الجداول وتفعيل سياسات الحماية RLS.

لخطوات إعداد وربط Supabase راجع [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md).
