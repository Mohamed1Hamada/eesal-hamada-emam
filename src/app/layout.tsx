import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo } from "next/font/google";
import { OFFICE_INFO } from "@/lib/static-data";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `نظام الإيصالات الإلكترونية - ${OFFICE_INFO.name}`,
  description: `النسخة التجريبية لنظام الإيصالات الإلكترونية الخاص بـ${OFFICE_INFO.name}. البيانات ثابتة والإرسال لمصلحة الضرائب محاكاة فقط.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.className}>
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
