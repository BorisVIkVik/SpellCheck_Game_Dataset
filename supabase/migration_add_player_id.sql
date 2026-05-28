-- Если typo_samples уже создана без player_id, выполни этот скрипт:

alter table public.typo_samples
  add column if not exists player_id text;

create index if not exists typo_samples_player_id_idx
  on public.typo_samples (player_id);
