import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

let browserClient: SupabaseClient | null = null;

/**
 * قراءة إعدادات Supabase العامة مع تجاهل القيم الافتراضية الوهمية في .env.example.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!url || !publishableKey) return null;
  if (
    url.includes("your-project-ref") ||
    publishableKey.includes("your_public_key_here")
  ) {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

/**
 * عميل Supabase للسيرفر (API Routes / Server Components).
 */
export function createSupabaseServerClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * عميل Supabase للمتصفح (يحفظ جلسة تسجيل الدخول للمكتب تلقائياً).
 */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  if (!browserClient) {
    browserClient = createClient(config.url, config.publishableKey);
  }

  return browserClient;
}
