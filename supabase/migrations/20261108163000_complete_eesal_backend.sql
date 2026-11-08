-- ============================================================================
-- Eesal / مكتب حماده امام عبد الفتاح
-- الملف التكميلي للباك إند على Supabase (المرحلة الثانية الكاملة)
-- شغّل هذا الملف مرة واحدة في Supabase -> SQL Editor -> Run
-- آمن لإعادة التشغيل (Idempotent) دون مسح أي بيانات موجودة.
-- ============================================================================

begin;

-- 1) استكمال الأعمدة والقيود الناقصة على الجداول الحالية
-- ----------------------------------------------------------------------------
alter table public.receipts
  add column if not exists paid_amount numeric(14, 2),
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

do $$
begin
  -- التحقق من أن المبلغ المدفوع غير سالب
  if not exists (
    select 1
    from pg_constraint
    where conname = 'receipts_paid_amount_non_negative_chk'
      and conrelid = 'public.receipts'::regclass
  ) then
    alter table public.receipts
      add constraint receipts_paid_amount_non_negative_chk
      check (paid_amount is null or paid_amount >= 0);
  end if;

  -- التحقق من أن نسبة الخصم في البنود لا تتجاوز 100%
  if not exists (
    select 1
    from pg_constraint
    where conname = 'receipt_items_discount_rate_max_chk'
      and conrelid = 'public.receipt_items'::regclass
  ) then
    alter table public.receipt_items
      add constraint receipt_items_discount_rate_max_chk
      check (discount_rate <= 100);
  end if;
end;
$$;

create index if not exists receipts_created_by_idx
  on public.receipts (created_by);

-- 2) تسلسل رقمي تلقائي آمن لأرقام الإيصالات بتوقيت مصر
-- ----------------------------------------------------------------------------
create sequence if not exists public.eesal_receipt_seq
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create or replace function public.next_eesal_receipt_number()
returns text
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_seq bigint;
begin
  v_seq := nextval('public.eesal_receipt_seq');
  return 'R-'
    || to_char(now() at time zone 'Africa/Cairo', 'YYYYMMDD')
    || '-'
    || lpad(v_seq::text, 4, '0');
end;
$$;

-- 3) تحديث الـ Trigger لتسجيل المستخدم المنشئ ومنع التلاعب بـ created_by
-- ----------------------------------------------------------------------------
create or replace function public.set_eesal_updated_at()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists receipts_set_updated_at on public.receipts;
create trigger receipts_set_updated_at
before insert or update on public.receipts
for each row
execute function public.set_eesal_updated_at();

-- 4) الصلاحيات وسياسات الحماية (Row Level Security - RLS)
-- ----------------------------------------------------------------------------
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

-- قفل الوصول المباشر عن الزوار غير المسجلين (anon)
revoke all on table public.receipts from anon;
revoke all on table public.receipt_items from anon;

-- منح الصلاحيات للمستخدمين المسجلين بحساب المكتب (authenticated)
grant select, insert, update, delete on table public.receipts to authenticated;
grant select, insert, update, delete on table public.receipt_items to authenticated;
grant usage, select on sequence public.eesal_receipt_seq to authenticated;

-- سياسات جدول receipts
drop policy if exists receipts_select_authenticated on public.receipts;
create policy receipts_select_authenticated
  on public.receipts
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists receipts_insert_authenticated on public.receipts;
create policy receipts_insert_authenticated
  on public.receipts
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists receipts_update_authenticated on public.receipts;
create policy receipts_update_authenticated
  on public.receipts
  for update
  to authenticated
  using (auth.uid() is not null and submission_status <> 'accepted')
  with check (auth.uid() is not null);

drop policy if exists receipts_delete_authenticated on public.receipts;
create policy receipts_delete_authenticated
  on public.receipts
  for delete
  to authenticated
  using (auth.uid() is not null and submission_status <> 'accepted');

-- سياسات جدول receipt_items
drop policy if exists receipt_items_select_authenticated on public.receipt_items;
create policy receipt_items_select_authenticated
  on public.receipt_items
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists receipt_items_insert_authenticated on public.receipt_items;
create policy receipt_items_insert_authenticated
  on public.receipt_items
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists receipt_items_update_authenticated on public.receipt_items;
create policy receipt_items_update_authenticated
  on public.receipt_items
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists receipt_items_delete_authenticated on public.receipt_items;
create policy receipt_items_delete_authenticated
  on public.receipt_items
  for delete
  to authenticated
  using (auth.uid() is not null);

-- 5) دالة الحفظ الذري الموحد (Atomic Transaction RPC)
--    تحفظ الإيصال + جميع بنوده في معاملة واحدة بحيث لا يُحفظ إيصال ناقص أبداً.
-- ----------------------------------------------------------------------------
create or replace function public.save_receipt_with_items(
  p_receipt jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_receipt_id uuid;
  v_receipt_number text;
  v_saved_receipt public.receipts;
  v_saved_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'يجب تسجيل الدخول أولاً لحفظ الإيصال'
      using errcode = '42501';
  end if;

  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then
    raise exception 'بيانات الإيصال غير صالحة'
      using errcode = '22023';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'يجب أن يحتوي الإيصال على صنف واحد على الأقل'
      using errcode = '22023';
  end if;

  v_receipt_id := coalesce(
    nullif(btrim(p_receipt->>'id'), '')::uuid,
    gen_random_uuid()
  );

  -- منع الكتابة فوق إيصال تم قبوله ضريبياً مسبقاً
  if exists (
    select 1
    from public.receipts r
    where r.id = v_receipt_id
      and r.submission_status = 'accepted'
  ) then
    raise exception 'لا يمكن تعديل إيصال تم قبوله مسبقاً'
      using errcode = '42501';
  end if;

  v_receipt_number := coalesce(
    nullif(btrim(p_receipt->>'receipt_number'), ''),
    public.next_eesal_receipt_number()
  );

  insert into public.receipts (
    id,
    receipt_number,
    receipt_type,
    issued_at,
    seller,
    buyer,
    payment_method,
    subtotal,
    total_discount,
    total_tax,
    grand_total,
    paid_amount,
    notes,
    submission_status,
    eta_uuid,
    submitted_at,
    submission_error,
    created_by
  )
  values (
    v_receipt_id,
    v_receipt_number,
    p_receipt->>'receipt_type',
    coalesce(nullif(btrim(p_receipt->>'issued_at'), '')::timestamptz, now()),
    p_receipt->'seller',
    p_receipt->'buyer',
    p_receipt->>'payment_method',
    coalesce((p_receipt->>'subtotal')::numeric(14, 2), 0),
    coalesce((p_receipt->>'total_discount')::numeric(14, 2), 0),
    coalesce((p_receipt->>'total_tax')::numeric(14, 2), 0),
    coalesce((p_receipt->>'grand_total')::numeric(14, 2), 0),
    case
      when p_receipt ? 'paid_amount'
        and p_receipt->>'paid_amount' is not null
        and btrim(p_receipt->>'paid_amount') <> ''
      then (p_receipt->>'paid_amount')::numeric(14, 2)
      else null
    end,
    nullif(btrim(p_receipt->>'notes'), ''),
    coalesce(nullif(btrim(p_receipt->>'submission_status'), ''), 'draft'),
    nullif(btrim(p_receipt->>'eta_uuid'), ''),
    case
      when p_receipt ? 'submitted_at'
        and p_receipt->>'submitted_at' is not null
        and btrim(p_receipt->>'submitted_at') <> ''
      then (p_receipt->>'submitted_at')::timestamptz
      else null
    end,
    nullif(btrim(p_receipt->>'submission_error'), ''),
    auth.uid()
  )
  on conflict (id) do update set
    receipt_number = excluded.receipt_number,
    receipt_type = excluded.receipt_type,
    issued_at = excluded.issued_at,
    seller = excluded.seller,
    buyer = excluded.buyer,
    payment_method = excluded.payment_method,
    subtotal = excluded.subtotal,
    total_discount = excluded.total_discount,
    total_tax = excluded.total_tax,
    grand_total = excluded.grand_total,
    paid_amount = excluded.paid_amount,
    notes = excluded.notes,
    submission_status = excluded.submission_status,
    eta_uuid = excluded.eta_uuid,
    submitted_at = excluded.submitted_at,
    submission_error = excluded.submission_error,
    updated_at = now()
  returning * into v_saved_receipt;

  delete from public.receipt_items ri
  where ri.receipt_id = v_receipt_id;

  insert into public.receipt_items (
    id,
    receipt_id,
    line_number,
    description,
    item_code,
    unit,
    quantity,
    unit_price,
    tax_code,
    tax_rate,
    discount_rate
  )
  select
    coalesce(nullif(btrim(elem.item->>'id'), '')::uuid, gen_random_uuid()),
    v_receipt_id,
    coalesce((elem.item->>'line_number')::integer, elem.idx::integer),
    btrim(elem.item->>'description'),
    nullif(btrim(elem.item->>'item_code'), ''),
    coalesce(nullif(btrim(elem.item->>'unit'), ''), 'خدمة'),
    (elem.item->>'quantity')::numeric(14, 3),
    (elem.item->>'unit_price')::numeric(14, 2),
    elem.item->>'tax_code',
    (elem.item->>'tax_rate')::numeric(7, 4),
    coalesce((elem.item->>'discount_rate')::numeric(7, 4), 0)
  from jsonb_array_elements(p_items) with ordinality as elem(item, idx);

  select coalesce(
    jsonb_agg(to_jsonb(ri) order by ri.line_number asc),
    '[]'::jsonb
  )
  into v_saved_items
  from public.receipt_items ri
  where ri.receipt_id = v_receipt_id;

  return jsonb_build_object(
    'receipt', to_jsonb(v_saved_receipt),
    'items', v_saved_items
  );
end;
$$;

revoke all on function public.save_receipt_with_items(jsonb, jsonb) from public, anon;
grant execute on function public.save_receipt_with_items(jsonb, jsonb) to authenticated;

revoke all on function public.next_eesal_receipt_number() from public, anon;
grant execute on function public.next_eesal_receipt_number() to authenticated;

commit;
