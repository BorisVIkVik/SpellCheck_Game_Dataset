#!/usr/bin/env node
/**
 * Однократный перенос sentences.txt → Supabase.
 * Запуск: node scripts/seed-sentences.js
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { importText } = require("../lib/sentences");
const { useSupabase } = require("../lib/supabase");

const file = path.join(__dirname, "..", "sentences.txt");

async function main() {
  if (!useSupabase()) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error("sentences.txt not found");
    process.exit(1);
  }

  const text = fs.readFileSync(file, "utf8");
  const result = await importText(text);
  console.log("Done:", result);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
