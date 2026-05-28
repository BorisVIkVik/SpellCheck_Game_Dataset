const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATASET_FILE = path.join(DATA_DIR, "typo_dataset.jsonl");

let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseClient;
}

function useSupabase() {
  return Boolean(getSupabase());
}

function saveSampleToFile(entry) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(DATASET_FILE, line, "utf8");
}

async function saveSample(entry) {
  const client = getSupabase();
  if (!client) {
    saveSampleToFile(entry);
    return { storage: "file" };
  }

  const { error } = await client.from("typo_samples").insert({
    original: entry.original,
    typed: entry.typed,
    created_at: entry.createdAt,
  });

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  return { storage: "supabase" };
}

async function fetchAllSamples() {
  const client = getSupabase();
  if (!client) {
    if (!fs.existsSync(DATASET_FILE)) return [];
    const lines = fs
      .readFileSync(DATASET_FILE, "utf8")
      .split(/\r?\n/)
      .filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  }

  const { data, error } = await client
    .from("typo_samples")
    .select("id, created_at, original, typed")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase fetch failed: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    original: row.original,
    typed: row.typed,
  }));
}

function getStorageInfo() {
  if (useSupabase()) {
    return { storage: "supabase", datasetFile: null };
  }
  return { storage: "file", datasetFile: DATASET_FILE };
}

module.exports = {
  saveSample,
  fetchAllSamples,
  useSupabase,
  getStorageInfo,
  DATASET_FILE,
};
