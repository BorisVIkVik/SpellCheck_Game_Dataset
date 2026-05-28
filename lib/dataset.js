const fs = require("fs");
const path = require("path");
const { getSupabase, useSupabase } = require("./supabase");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATASET_FILE = path.join(DATA_DIR, "typo_dataset.jsonl");

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

  const row = {
    original: entry.original,
    typed: entry.typed,
    created_at: entry.createdAt,
  };
  if (entry.playerId) {
    row.player_id = entry.playerId;
  }
  if (entry.deviceType) {
    row.device_type = entry.deviceType;
  }

  const { error } = await client.from("typo_samples").insert(row);

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
    .select("id, created_at, player_id, device_type, original, typed")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase fetch failed: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    playerId: row.player_id,
    deviceType: row.device_type,
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
  getStorageInfo,
  DATASET_FILE,
};
