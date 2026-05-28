# PDF → TXT (Python)

Конвертация PDF в текст и удаление служебных блоков Викитеки:

- в начале: `Экспортировано из Викитеки <дата>`
- в конце: «Об этом электронном издании», лицензия, участники, Document Outline

## Установка

```bash
cd tools/pdf-to-txt
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Использование

```bash
# book.pdf → book.txt
python pdf_to_txt.py book.pdf

# свой путь
python pdf_to_txt.py book.pdf -o sentences.txt

# несколько файлов
python pdf_to_txt.py ./*.pdf
```

## Дальше

Полученный `.txt` загрузи в `/admin.html` — предложения попадут в Supabase.

## Ограничения

- Нужен **текстовый** PDF (не скан). Для сканов сначала OCR (`ocrmypdf`).
