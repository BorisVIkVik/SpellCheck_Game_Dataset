-- Выполни в Supabase: SQL Editor → New query → Run

create table if not exists public.typo_samples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  player_id text,
  original text not null,
  typed text not null default ''
);

create index if not exists typo_samples_player_id_idx
  on public.typo_samples (player_id);

create index if not exists typo_samples_created_at_idx
  on public.typo_samples (created_at desc);

-- Эталонные предложения для игры
create table if not exists public.source_sentences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  text text not null unique
);

create index if not exists source_sentences_created_at_idx
  on public.source_sentences (created_at desc);

-- Сервер пишет через service_role key (RLS можно не включать для этих таблиц
-- или включить и не давать публичный доступ — только backend).
