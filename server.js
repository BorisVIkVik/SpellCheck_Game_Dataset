const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const HOST = "127.0.0.1";
const PORT = 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATASET_FILE = path.join(DATA_DIR, "typo_dataset.jsonl");
const SENTENCES_FILE = path.join(ROOT_DIR, "sentences.txt");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSentences() {
  if (!fs.existsSync(SENTENCES_FILE)) {
    return [];
  }

  const lines = fs
    .readFileSync(SENTENCES_FILE, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines;
}

function sendJson(res, statusCode, payload) {
  const json = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
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

function saveSample(entry) {
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(DATASET_FILE, line, "utf8");
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/next-sentence") {
    const sentences = loadSentences();
    if (sentences.length === 0) {
      sendJson(res, 500, { error: "No sentences in sentences.txt" });
      return;
    }

    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    sendJson(res, 200, { sentence });
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
      saveSample(entry);
      sendJson(res, 200, { ok: true });
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
  console.log(`Game running at http://${HOST}:${PORT}`);
  console.log(`Dataset file: ${DATASET_FILE}`);
});
