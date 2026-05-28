#!/usr/bin/env python3
"""
Конвертация PDF → TXT с удалением хвоста Викитеки (лицензия, участники, оглавление PDF).

Usage:
  python pdf_to_txt.py book.pdf
  python pdf_to_txt.py book.pdf -o book.txt
  python pdf_to_txt.py ./pdfs/*.pdf
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    print("Установи зависимости: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


# «Экспортировано из Викитеки 28 мая 2026 г.» — дата произвольная.
WIKISOURCE_EXPORT_HEADER = re.compile(
    r"экспортировано\s+из\s+викитеки\s+"
    r"(?:\d{1,2}[\s\u00a0\u202f]+)?"
    r"(?:[а-яёА-ЯЁ]+[\s\u00a0\u202f]+)*"
    r"\d{4}[\s\u00a0\u202f]*"
    r"(?:г\.?)?",
    re.IGNORECASE,
)

# Начало блока «Об этом электронном издании» (с переносами между словами в PDF).
WIKISOURCE_FOOTER_START = re.compile(
    r"об\s+этом\s+электронном(?:\s+издании)?",
    re.IGNORECASE | re.DOTALL,
)

# Запасные маркеры хвоста, если основной не найден.
WIKISOURCE_FOOTER_FALLBACKS = [
    re.compile(r"эта\s+книга\s+из\s+викитеки", re.IGNORECASE | re.DOTALL),
    re.compile(r"викитека\s+приветствует\s+новых\s+участников", re.IGNORECASE | re.DOTALL),
    re.compile(r"document\s+outline", re.IGNORECASE | re.DOTALL),
    re.compile(r"creativecommons\.org/licenses", re.IGNORECASE),
    re.compile(r"gnu\.org/copyleft/fdl", re.IGNORECASE),
    re.compile(r"wikisource\.org/wiki/викитека:форум", re.IGNORECASE),
]


def extract_text_from_pdf(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    parts: list[str] = []
    try:
        for page in doc:
            parts.append(page.get_text("text"))
    finally:
        doc.close()
    return "\n".join(parts)


def normalize_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def strip_wikisource_header(text: str) -> str:
    """Удаляет строку «Экспортировано из Викитеки <дата>» в начале."""
    text = WIKISOURCE_EXPORT_HEADER.sub("", text, count=1)

    lines = text.split("\n")
    cleaned: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.search(r"экспортировано\s+из\s+викитеки", line, re.IGNORECASE):
            i += 1
            # В PDF «г.» иногда на следующей строке
            if i < len(lines) and re.fullmatch(r"\s*г\.?\s*", lines[i]):
                i += 1
            continue
        cleaned.append(line)
        i += 1

    return "\n".join(cleaned).strip()


def strip_wikisource_footer(text: str) -> str:
    """Удаляет всё начиная с блока «Об этом электронном [издании]»."""
    match = WIKISOURCE_FOOTER_START.search(text)
    if match:
        return text[: match.start()].rstrip()

    for pattern in WIKISOURCE_FOOTER_FALLBACKS:
        m = pattern.search(text)
        if m:
            return text[: m.start()].rstrip()

    return text


def strip_trailing_noise(text: str) -> str:
    """Убирает хвостовой мусор: стрелки сносок, пустые номера страниц."""
    lines = text.split("\n")
    cleaned: list[str] = []

    for line in lines:
        s = line.strip()
        if re.fullmatch(r"↑\s*\d*", s):
            continue
        if re.fullmatch(r"\d{1,4}", s):
            continue
        cleaned.append(line)

    text = "\n".join(cleaned)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def convert_pdf(pdf_path: Path, output_path: Path | None = None) -> Path:
    if not pdf_path.is_file():
        raise FileNotFoundError(f"Файл не найден: {pdf_path}")
    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError(f"Ожидался PDF: {pdf_path}")

    out = output_path or pdf_path.with_suffix(".txt")

    raw = extract_text_from_pdf(pdf_path)
    text = normalize_whitespace(raw)
    text = strip_wikisource_header(text)
    text = strip_wikisource_footer(text)
    text = strip_trailing_noise(text)

    out.write_text(text + ("\n" if text else ""), encoding="utf-8")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="PDF → TXT с удалением хвоста Викитеки"
    )
    parser.add_argument(
        "pdf",
        nargs="+",
        type=Path,
        help="Один или несколько PDF-файлов",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Выходной .txt (только при одном входном PDF)",
    )
    args = parser.parse_args()

    if args.output is not None and len(args.pdf) != 1:
        parser.error("Флаг -o можно использовать только с одним PDF")

    for pdf_path in args.pdf:
        try:
            out = convert_pdf(pdf_path, args.output)
            chars = out.stat().st_size
            print(f"OK: {pdf_path.name} → {out.name} ({chars} bytes)")
        except Exception as exc:
            print(f"Ошибка ({pdf_path.name}): {exc}", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
