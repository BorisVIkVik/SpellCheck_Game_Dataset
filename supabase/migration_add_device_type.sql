-- Если typo_samples уже создана без device_type:

alter table public.typo_samples
  add column if not exists device_type text;

create index if not exists typo_samples_device_type_idx
  on public.typo_samples (device_type);
