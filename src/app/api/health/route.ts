import { getSupabasePublicConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseConfig = getSupabasePublicConfig();

  return Response.json(
    {
      ok: true,
      service: "eesal-hamada-emam",
      supabaseConfigured: Boolean(supabaseConfig),
      timestamp: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
