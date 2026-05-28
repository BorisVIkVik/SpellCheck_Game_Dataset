let currentSentence = "";
let typedSentence = "";
let isSubmitting = false;
let isComposing = false;

const targetEl = document.getElementById("target");
const statusEl = document.getElementById("status");
const nextBtn = document.getElementById("nextBtn");
const gameEl = document.getElementById("game");
const typingInput = document.getElementById("typingInput");
const typingCard = document.getElementById("typingCard");
const PLAYER_ID_KEY = "typo_game_player_id";

function createPlayerId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreatePlayerId() {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = createPlayerId();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

const playerId = getOrCreatePlayerId();

function detectDeviceType() {
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) {
    return "tablet";
  }
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) {
    return "tablet";
  }
  if (/Android|iPhone|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)) {
    return "mobile";
  }
  if (window.matchMedia("(max-width: 900px)").matches && navigator.maxTouchPoints > 0) {
    return "mobile";
  }
  return "desktop";
}

const deviceType = detectDeviceType();

function focusTyping() {
  typingInput.focus({ preventScroll: true });
}

function clearTypingInput() {
  typingInput.value = "";
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff9b9b" : "#8de7a5";
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTargetWithActiveChar() {
  if (!currentSentence) {
    targetEl.textContent = "Пустое предложение";
    return;
  }

  const activeIndex = typedSentence.length;
  const chars = [...currentSentence].map((ch, idx) => {
    const safe = escapeHtml(ch === " " ? "\u00A0" : ch);
    if (idx < activeIndex) {
      return `<span class="target-char target-char--done">${safe}</span>`;
    }
    if (idx === activeIndex) {
      return `<span class="target-char target-char--active">${safe}</span>`;
    }
    return `<span class="target-char">${safe}</span>`;
  });

  targetEl.innerHTML = chars.join("");
}

function renderMasked() {
  renderTargetWithActiveChar();
}

function isLatinLetter(ch) {
  return /^[A-Za-z]$/.test(ch);
}

async function appendCharacter(ch) {
  if (!currentSentence || isSubmitting) return;
  if (typedSentence.length >= currentSentence.length) return;

  if (ch === "\n") {
    await submitTypedSentence();
    return;
  }

  if (isLatinLetter(ch)) {
    setStatus("Включи русскую раскладку клавиатуры.", true);
    return;
  }

  typedSentence += ch;
  renderMasked();

  if (typedSentence.length === currentSentence.length) {
    await submitTypedSentence();
  }
}

async function processInputValue() {
  const value = typingInput.value;
  clearTypingInput();
  if (!value || !currentSentence || isSubmitting) return;

  for (const ch of value) {
    if (typedSentence.length >= currentSentence.length) break;
    await appendCharacter(ch);
  }
}

async function loadNextSentence() {
  if (isSubmitting) return;

  setStatus("Загрузка предложения...");
  typedSentence = "";
  currentSentence = "";
  clearTypingInput();
  renderMasked();

  try {
    const res = await fetch("/api/next-sentence");
    if (!res.ok) throw new Error("Не удалось получить предложение");
    const data = await res.json();
    currentSentence = data.sentence || "";
    renderMasked();
    setStatus("Печатай. Исправление назад отключено.");
    focusTyping();
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function submitTypedSentence() {
  if (isSubmitting || !currentSentence) return;
  isSubmitting = true;

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        deviceType,
        original: currentSentence,
        typed: typedSentence,
      }),
    });
    if (!res.ok) throw new Error("Ошибка сохранения");
    setStatus("Сохранено в датасет. Загружаю следующее...");
    await loadNextSentence();
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    isSubmitting = false;
  }
}

document.addEventListener(
  "keydown",
  async (event) => {
    if (!currentSentence || isSubmitting) return;
    if (document.activeElement === typingInput) return;

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      await submitTypedSentence();
      return;
    }

    if (event.key.length !== 1) return;
    if (typedSentence.length >= currentSentence.length) return;

    event.preventDefault();
    await appendCharacter(event.key);
  },
  true
);

typingInput.addEventListener("compositionstart", () => {
  isComposing = true;
});

typingInput.addEventListener("compositionend", () => {
  isComposing = false;
  void processInputValue();
});

typingInput.addEventListener("input", () => {
  if (isComposing) return;
  void processInputValue();
});

typingInput.addEventListener("keydown", (event) => {
  if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    clearTypingInput();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    submitTypedSentence();
  }
});

typingInput.addEventListener("paste", (event) => {
  event.preventDefault();
});

typingCard.addEventListener("click", () => {
  focusTyping();
});

nextBtn.addEventListener("mousedown", (event) => event.preventDefault());
nextBtn.addEventListener("click", () => {
  loadNextSentence();
});

loadNextSentence();
