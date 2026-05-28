require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { saveSample, fetchAllSamples, getStorageInfo } = require("./lib/dataset");
const { useSupabase } = require("./lib/supabase");
const { loadSentenceTexts, importText } = require("./lib/sentences");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const EXPORT_TOKEN = process.env.EXPORT_TOKEN || "";

const PUBLIC_DIR = path.join(__dirname, "public");
const issuedSentences = new Set();

function getNextSentenceWithoutRepeat(sentences) {
  if (sentences.length === 0) return null;

  const sentenceSet = new Set(sentences);
  for (const issued of issuedSentences) {
    if (!sentenceSet.has(issued)) {
      issuedSentences.delete(issued);
    }
  }

  if (issuedSentences.size >= sentences.length) {
    issuedSentences.clear();
  }

  const available = sentences.filter((sentence) => !issuedSentences.has(sentence));
  if (available.length === 0) {
    return null;
  }

  const sentence = available[Math.floor(Math.random() * available.length)];
  issuedSentences.add(sentence);
  return sentence;
}

function sendJson(res, statusCode, payload) {
  const json = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function sendDownload(res, statusCode, body, filename, contentType) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": Buffer.byteLength(body, "utf8"),
  });
  res.end(body, "utf8");
}

function parseBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > maxBytes) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function parseTextBody(req, maxBytes = 5_000_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (Buffer.byteLength(data, "utf8") > maxBytes) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function serveStatic(reqPath, res) {
  const normalized = reqPath === "/" ? "/index.html" : reqPath;
  const safePath = path.normalize(normalized).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Content-Length": content.length,
  });
  res.end(content);
}

function isAdminAuthorized(url) {
  if (!EXPORT_TOKEN) return false;
  return url.searchParams.get("token") === EXPORT_TOKEN;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/next-sentence") {
    try {
      const sentences = await loadSentenceTexts();
      if (sentences.length === 0) {
        sendJson(res, 500, {
          error: "No sentences in database. Import text via /admin.html",
        });
        return;
      }

      const sentence = getNextSentenceWithoutRepeat(sentences);
      if (!sentence) {
        sendJson(res, 500, { error: "Failed to pick next sentence" });
        return;
      }
      sendJson(res, 200, { sentence });
    } catch (err) {
      sendJson(res, 500, { error: err.message || "Failed to load sentences" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sentences/import") {
    if (!isAdminAuthorized(url)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const text = await parseTextBody(req);
      if (!text.trim()) {
        sendJson(res, 400, { error: "Empty text" });
        return;
      }

      const result = await importText(text);
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      sendJson(res, 400, { error: err.message || "Import failed" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/export-dataset") {
    if (!isAdminAuthorized(url)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const format = url.searchParams.get("format") || "json";
      const rows = await fetchAllSamples();

      if (format === "jsonl") {
        const body = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
        sendDownload(res, 200, body, "typo_dataset.jsonl", "application/x-ndjson; charset=utf-8");
        return;
      }

      sendDownload(
        res,
        200,
        JSON.stringify(rows, null, 2),
        "typo_dataset.json",
        "application/json; charset=utf-8"
      );
    } catch (err) {
      sendJson(res, 500, { error: err.message || "Export failed" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/submit") {
    try {
      const body = await parseBody(req);
      const original = typeof body.original === "string" ? body.original : "";
      const typed = typeof body.typed === "string" ? body.typed : "";

      if (!original) {
        sendJson(res, 400, { error: "Field 'original' is required" });
        return;
      }

      const entry = {
        createdAt: new Date().toISOString(),
        original,
        typed,
      };
      const result = await saveSample(entry);
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      sendJson(res, 400, { error: err.message || "Bad request" });
    }
    return;
  }

  if (req.method === "GET") {
    serveStatic(url.pathname, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, HOST, () => {
  const info = getStorageInfo();
  console.log(`Game running at http://${HOST}:${PORT}`);
  console.log(`Dataset storage: ${info.storage}`);
  if (info.datasetFile) {
    console.log(`Local fallback file: ${info.datasetFile}`);
  }
  if (!useSupabase()) {
    console.warn(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
  }
  if (EXPORT_TOKEN) {
    console.log("Admin: /admin.html (import sentences)");
    console.log("Export: GET /api/export-dataset?token=...&format=json|jsonl");
  }
});
