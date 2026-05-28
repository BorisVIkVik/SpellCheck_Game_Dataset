const fs = require("fs");
const path = require("path");
const { getSupabase, useSupabase } = require("./supabase");
const { filterValidSentences, sanitizeText } = require("./textFilter");

const SENTENCES_FILE = path.join(__dirname, "..", "sentences.txt");

let sentencesCache = null;
let sentencesCacheAt = 0;
const CACHE_MS = 30_000;

function splitTextIntoSentences(text) {
  // Переносы строк не делят предложения — только «.» и «;».
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!normalized) return [];

  const sentences = [];
  const parts = normalized.split(/(?<=[.;])\s*/u);

  for (const part of parts) {
    const sentence = part.trim();
    if (sentence.length >= 2) {
      sentences.push(sentence);
    }
  }

  return [...new Set(sentences)];
}

function loadSentencesFromFile() {
  if (!fs.existsSync(SENTENCES_FILE)) return [];
  return fs
    .readFileSync(SENTENCES_FILE, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function fetchSentenceTextsFromDb() {
  const client = getSupabase();
  if (!client) return loadSentencesFromFile();

  const { data, error } = await client
    .from("source_sentences")
    .select("text")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase sentences fetch failed: ${error.message}`);
  }

  return (data || []).map((row) => row.text);
}

async function loadSentenceTexts({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && sentencesCache && now - sentencesCacheAt < CACHE_MS) {
    return sentencesCache;
  }

  const texts = await fetchSentenceTextsFromDb();
  sentencesCache = texts;
  sentencesCacheAt = now;
  return texts;
}

function invalidateSentenceCache() {
  sentencesCache = null;
  sentencesCacheAt = 0;
}

async function insertSentences(texts) {
  const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { inserted: 0, skipped: 0, total: 0 };
  }

  const client = getSupabase();
  if (!client) {
    throw new Error("Supabase is required to import sentences");
  }

  const rows = unique.map((text) => ({ text }));
  const { data, error } = await client
    .from("source_sentences")
    .upsert(rows, { onConflict: "text", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw new Error(`Supabase sentences insert failed: ${error.message}`);
  }

  invalidateSentenceCache();

  const inserted = (data || []).length;
  return {
    inserted,
    skipped: unique.length - inserted,
    total: unique.length,
  };
}

async function importText(text) {
  const cleanedText = sanitizeText(text);
  const raw = splitTextIntoSentences(cleanedText);
  const sentences = filterValidSentences(raw);
  const result = await insertSentences(sentences);
  return {
    ...result,
    parsed: raw.length,
    accepted: sentences.length,
    rejected: raw.length - sentences.length,
  };
}

module.exports = {
  splitTextIntoSentences,
  loadSentenceTexts,
  invalidateSentenceCache,
  importText,
  useSupabase,
  SENTENCES_FILE,
  filterValidSentences,
  sanitizeText,
};
