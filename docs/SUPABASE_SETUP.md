# ربط وتشغيل Supabase — خطوة بخطوة

التطبيق يعمل تلقائياً في وضعين:
- **بدون `.env.local`:** يعمل محلياً على المتصفح (`localStorage`) للتجربة السريعة.
- **بمجرد وضع مفاتيح Supabase في `.env.local`:** يفعّل شاشة **تسجيل دخول المكتب** تلقائياً ويحفظ ويسترجع الإيصالات مباشرة من قاعدة بيانات **Supabase**.

---

## 1) وضع بيانات الاتصال في جهازك (أو على Vercel)

1. من أعلى لوحة تحكم Supabase اضغط **Connect**.
2. انسخ القيمتين العامتين فقط:
   - `Project URL`
   - `Publishable Key` (أو `Anon Key`)
3. أنشئ ملفاً باسم `.env.local` في جذر المشروع بجوار `package.json`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

4. أعد تشغيل السيرفر:

```bash
npm run dev
```

*(لا تضع أي `service_role` أو `Secret Key` في ملفات الواجهة أو في Git).*

---

## 2) تشغيل ملفات قاعدة البيانات (SQL Migrations)

من **Supabase → SQL Editor** شغّل بالترتيب:
1. `supabase/migrations/20261107150000_create_eesal_receipts.sql`
2. `supabase/migrations/20261108163000_complete_eesal_backend.sql`

---

## 3) إعداد مستخدم المكتب (Authentication)

1. من **Authentication → Sign In / Providers** عطّل خيار **Allow new users to sign up**.
2. من **Authentication → Users** اضغط **Add user → Create new user**، وأنشئ بريد وكلمة مرور المكتب مع تفعيل **Auto Confirm User**.
3. افتح الموقع وسجّل الدخول؛ سيتم حفظ جميع الإيصالات وبنودها تلقائياً عبر دالة المعاملة الموحدة `save_receipt_with_items`.
