let currentSentence = "";
let typedSentence = "";
let isSubmitting = false;

const targetEl = document.getElementById("target");
const maskedEl = document.getElementById("masked");
const progressEl = document.getElementById("progress");
const statusEl = document.getElementById("status");
const nextBtn = document.getElementById("nextBtn");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff9b9b" : "#8de7a5";
}

function visibleCharMask(ch) {
  if (ch === " ") return " ";
  return "•";
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
  const typedMask = [...typedSentence].map(visibleCharMask).join("");
  const remaining = currentSentence.length - typedSentence.length;
  const placeholders = remaining > 0 ? "_".repeat(remaining) : "";
  maskedEl.textContent = typedMask + placeholders;
  progressEl.textContent = `${typedSentence.length} / ${currentSentence.length}`;
  renderTargetWithActiveChar();
}

async function loadNextSentence() {
  if (isSubmitting) return;

  setStatus("Загрузка предложения...");
  typedSentence = "";
  currentSentence = "";
  renderMasked();

  try {
    const res = await fetch("/api/next-sentence");
    if (!res.ok) throw new Error("Не удалось получить предложение");
    const data = await res.json();
    currentSentence = data.sentence || "";
    renderMasked();
    setStatus("Печатай. Исправление назад отключено.");
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

document.addEventListener("keydown", async (event) => {
  if (!currentSentence || isSubmitting) return;

  if (event.key === "Backspace" || event.key === "Delete") {
    // Специально блокируем удаление уже введенных символов.
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

  typedSentence += event.key;
  renderMasked();

  if (typedSentence.length === currentSentence.length) {
    await submitTypedSentence();
  }
});

nextBtn.addEventListener("click", loadNextSentence);

loadNextSentence();
