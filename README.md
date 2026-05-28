# Игра для сбора опечаток

## Supabase

1. Создай проект на [supabase.com](https://supabase.com).
2. **SQL Editor** → вставь и выполни `supabase/schema.sql`.
3. **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (secret) → `SUPABASE_SERVICE_ROLE_KEY`
4. Скопируй `.env.example` в `.env` и заполни переменные.
5. На Render добавь те же переменные в **Environment**.

Без Supabase записи пишутся в `data/typo_dataset.jsonl` (локальный fallback).

## Запуск

```bash
npm install
npm start
```

## Экспорт датасета

Задай `EXPORT_TOKEN` в `.env`, затем:

```bash
# JSON-массив
curl -o typo_dataset.json \
  "http://localhost:3000/api/export-dataset?token=YOUR_TOKEN&format=json"

# JSONL
curl -o typo_dataset.jsonl \
  "http://localhost:3000/api/export-dataset?token=YOUR_TOKEN&format=jsonl"
```

В Supabase данные также видны в **Table Editor → typo_samples**.
