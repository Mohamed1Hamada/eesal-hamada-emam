"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { OFFICE_INFO } from "@/lib/static-data";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("من فضلك أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("إعدادات الاتصال بـ Supabase غير مكتملة.");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        setError(
          authError.message.toLowerCase().includes("invalid")
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
            : authError.message
        );
      }
    } catch {
      setError("تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-[var(--brand)] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl md:text-2xl font-bold">
            نظام الإيصالات الإلكترونية
          </h1>
          <p className="text-sm text-white/80">
            {OFFICE_INFO.name} • مكتب محاسب قانوني
          </p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4"
        >
          <div className="text-center space-y-1 pb-2 border-b border-slate-100">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--brand)] text-white font-bold text-lg flex items-center justify-center mb-2">
              {OFFICE_INFO.name.charAt(0)}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              تسجيل دخول المكتب
            </h2>
            <p className="text-xs text-slate-500">
              أدخل حساب المكتب المسجل على قاعدة بيانات Supabase
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs font-medium text-red-800">
              {error}
            </div>
          )}

          <label className="block">
            <div className="text-sm font-medium text-slate-700 mb-1">
              البريد الإلكتروني
            </div>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="office@example.com"
              className="form-input"
              dir="ltr"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-slate-700 mb-1">
              كلمة المرور
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              dir="ltr"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[var(--brand)] text-white rounded-lg font-medium hover:bg-[var(--brand-dark)] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "جاري تسجيل الدخول..." : "دخول للنظام"}
          </button>
        </form>
      </main>
    </div>
  );
}
