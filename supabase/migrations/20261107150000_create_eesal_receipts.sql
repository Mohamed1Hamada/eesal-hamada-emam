-- Eesal / مكتب حماده امام عبد الفتاح
-- الخطوة الأولى في Supabase: إنشاء جداول الإيصالات وبنودها.
-- شغّل هذا الملف مرة واحدة من Supabase SQL Editor.
-- لا توجد سياسات وصول عامة هنا؛ تظل البيانات مقفلة حتى نضيف تسجيل الدخول والصلاحيات.

create extension if not exists pgcrypto;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  receipt_type text not null check (
    receipt_type in ('cash', 'credit', 'return_cash', 'return_credit')
  ),
  issued_at timestamptz not null,
  seller jsonb not null check (jsonb_typeof(seller) = 'object'),
  buyer jsonb not null check (jsonb_typeof(buyer) = 'object'),
  payment_method text not null check (
    payment_method in ('cash', 'card', 'bank_transfer', 'check')
  ),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  total_discount numeric(14, 2) not null default 0 check (total_discount >= 0),
  total_tax numeric(14, 2) not null default 0 check (total_tax >= 0),
  grand_total numeric(14, 2) not null default 0 check (grand_total >= 0),
  notes text,
  submission_status text not null default 'draft' check (
    submission_status in ('draft', 'submitted', 'accepted', 'rejected', 'failed')
  ),
  eta_uuid text,
  submitted_at timestamptz,
  submission_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  description text not null,
  item_code text,
  unit text not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  tax_code text not null,
  tax_rate numeric(7, 4) not null check (tax_rate >= 0),
  discount_rate numeric(7, 4) not null default 0 check (discount_rate >= 0),
  created_at timestamptz not null default now(),
  unique (receipt_id, line_number)
);

create index if not exists receipts_issued_at_idx
  on public.receipts (issued_at desc);

create index if not exists receipts_submission_status_idx
  on public.receipts (submission_status);

create index if not exists receipt_items_receipt_id_idx
  on public.receipt_items (receipt_id);

create or replace function public.set_eesal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists receipts_set_updated_at on public.receipts;
create trigger receipts_set_updated_at
before update on public.receipts
for each row
execute function public.set_eesal_updated_at();

-- الأمان أولاً: تفعيل RLS بدون أي سياسة عامة في هذه الخطوة.
-- لذلك لن يستطيع المفتاح العام قراءة أو كتابة البيانات حتى نضيف Auth والصلاحيات.
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
