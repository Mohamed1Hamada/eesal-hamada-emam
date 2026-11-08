import {
  createSupabaseServerClient,
  getSupabasePublicConfig,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const config = getSupabasePublicConfig();

  if (!config) {
    return json({
      ok: false,
      state: "not_configured",
      message:
        "لم يتم ضبط NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY في ملف .env.local بعد.",
      storageSwitched: false,
    });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return json(
      {
        ok: false,
        state: "invalid_config",
        message: "إعدادات Supabase غير مكتملة.",
        storageSwitched: false,
      },
      500
    );
  }

  try {
    // استخدام GET عادي بدلاً من HEAD لقراءة كود ورسالة سياسات RLS بدقة
    const { error } = await supabase.from("receipts").select("id").limit(1);

    if (!error) {
      return json({
        ok: true,
        state: "connected",
        message: "تم الاتصال بـSupabase وجدول receipts متاح.",
        storageSwitched: true,
      });
    }

    const code = String((error as { code?: unknown }).code || "");
    const message = String(error.message || "");

    if (
      code === "42P01" ||
      message.includes("Could not find the table") ||
      message.includes('relation "public.receipts" does not exist')
    ) {
      return json({
        ok: false,
        state: "schema_missing",
        message:
          "تم الوصول إلى Supabase، لكن جدول receipts غير موجود. شغّل ملفات SQL أولاً.",
        storageSwitched: false,
      });
    }

    if (
      code === "42501" ||
      /permission denied|row-level security|unauthorized|forbidden/i.test(
        message
      )
    ) {
      return json({
        ok: true,
        state: "rls_protected",
        message:
          "الاتصال بـSupabase سليم والجدول محمي بسياسات RLS ضد الزوار غير المسجلين. يعمل الحفظ تلقائياً بعد تسجيل دخول المكتب.",
        storageSwitched: true,
      });
    }

    return json({
      ok: false,
      state: "reachable_with_error",
      message: "تم الوصول إلى Supabase، لكن فحص الجدول لم يكتمل.",
      detail: message || code,
      storageSwitched: false,
    });
  } catch {
    return json(
      {
        ok: false,
        state: "unreachable",
        message:
          "تعذر الوصول إلى Supabase. تحقق من رابط المشروع أو الاتصال بالإنترنت.",
        storageSwitched: false,
      },
      503
    );
  }
}
