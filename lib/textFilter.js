/** Допустимы: кириллица, цифры, пробелы, обычные знаки препинания. */

const URL_PATTERN =
  /https?:\/\/|www\.|wikisource|creativecommons|\.(?:org|com|ru|html)\b/i;

const LATIN_PATTERN = /[a-zA-Z]/;

const ALLOWED_CHARS_PATTERN =
  /^[\u0400-\u04FF0-9\s.,!?…—–\-«»„""''():;[\]№%]+$/u;

function hasUrl(text) {
  return URL_PATTERN.test(text);
}

function hasLatin(text) {
  return LATIN_PATTERN.test(text);
}

function hasOnlyAllowedChars(text) {
  return ALLOWED_CHARS_PATTERN.test(text);
}

function isValidRussianSentence(text) {
  const sentence = text.trim();
  if (sentence.length < 2) return false;
  if (hasUrl(sentence)) return false;
  if (hasLatin(sentence)) return false;
  if (!hasOnlyAllowedChars(sentence)) return false;
  // Хотя бы одна кириллическая буква
  if (!/[\u0400-\u04FF]/.test(sentence)) return false;
  return true;
}

function sanitizeLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return "";

  if (hasUrl(trimmed) || hasLatin(trimmed)) {
    return null;
  }

  const cleaned = trimmed
    .replace(/[^\u0400-\u04FF0-9\s.,!?…—–\-«»„""''():;[\]№%]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned || !/[\u0400-\u04FF]/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function sanitizeText(text) {
  const lines = text.split("\n");
  const cleaned = [];

  for (const line of lines) {
    const row = sanitizeLine(line);
    if (row === null) continue;
    cleaned.push(row);
  }

  return cleaned.join("\n");
}

function filterValidSentences(sentences) {
  return sentences.filter(isValidRussianSentence);
}

module.exports = {
  isValidRussianSentence,
  filterValidSentences,
  sanitizeText,
};
