# Игра для сбора опечаток

## Supabase

1. Создай проект на [supabase.com](https://supabase.com).
2. **SQL Editor** → выполни `supabase/schema.sql` (таблицы `typo_samples` и `source_sentences`).
3. **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Скопируй `.env.example` в `.env` и заполни переменные.
5. Перенеси стартовые предложения из `sentences.txt`:

```bash
node scripts/seed-sentences.js
```

6. На Render добавь те же переменные в **Environment**.

## Запуск

```bash
npm install
npm start
```

Игра: `http://localhost:3000`  
Импорт предложений: `http://localhost:3000/admin.html` (нужен `EXPORT_TOKEN` в `.env`).

## Пополнение списка предложений

1. Открой `/admin.html`.
2. Введи `EXPORT_TOKEN`.
3. Загрузи `.txt` файл — текст разбивается по `.!?…` и переносам строк.
4. Новые предложения попадают в таблицу `source_sentences` (дубликаты не добавляются).

Или через API:

```bash
curl -X POST \
  "http://localhost:3000/api/sentences/import?token=YOUR_TOKEN" \
  -H "Content-Type: text/plain; charset=utf-8" \
  --data-binary @my_text.txt
```

## Экспорт датасета опечаток

```bash
curl -o typo_dataset.json \
  "http://localhost:3000/api/export-dataset?token=YOUR_TOKEN&format=json"
```

Данные также в **Table Editor**: `typo_samples`, `source_sentences`.

## Анонимный player_id

У каждого браузера свой UUID в `localStorage` — после перезагрузки страницы он сохраняется.
Поле `player_id` пишется в `typo_samples` при каждой отправке.

Если таблица уже создана, выполни `supabase/migration_add_player_id.sql`.

## Тип устройства (mobile / desktop / tablet)

При каждой отправке сохраняется `device_type` (определяется в браузере; на сервере при необходимости уточняется по `User-Agent`).

Миграция для существующей БД: `supabase/migration_add_device_type.sql`.
