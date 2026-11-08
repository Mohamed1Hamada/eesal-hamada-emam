import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/cairo/300.css";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import { OFFICE_INFO } from "@/lib/static-data";
import "./globals.css";

export const metadata: Metadata = {
  title: `نظام الإيصالات الإلكترونية - ${OFFICE_INFO.name}`,
  description: `نظام إصدار وإدارة الإيصالات الضريبية وإيصالات استلام الأتعاب الخاص بـ${OFFICE_INFO.name}.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
