-- Выполни в Supabase: SQL Editor → New query → Run

create table if not exists public.typo_samples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  original text not null,
  typed text not null default ''
);

create index if not exists typo_samples_created_at_idx
  on public.typo_samples (created_at desc);

-- Сервер пишет через service_role key (RLS можно не включать для этой таблицы
-- или включить и не давать публичный доступ — только backend).
