const tokenEl = document.getElementById("token");
const fileEl = document.getElementById("file");
const uploadBtn = document.getElementById("uploadBtn");
const statusEl = document.getElementById("status");

const TOKEN_KEY = "typo_game_admin_token";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff9b9b" : "#8de7a5";
}

tokenEl.value = localStorage.getItem(TOKEN_KEY) || "";

uploadBtn.addEventListener("click", async () => {
  const token = tokenEl.value.trim();
  const file = fileEl.files[0];

  if (!token) {
    setStatus("Укажи токен.", true);
    return;
  }
  if (!file) {
    setStatus("Выбери файл.", true);
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
  uploadBtn.disabled = true;
  setStatus("Загрузка...");

  try {
    const text = await file.text();
    const res = await fetch(
      `/api/sentences/import?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text,
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка импорта");

    setStatus(
      `Готово: распознано ${data.parsed}, принято ${data.accepted ?? data.parsed}, ` +
        `отклонено (англ./ссылки/символы) ${data.rejected ?? 0}, ` +
        `добавлено ${data.inserted}, дубликатов ${data.skipped}.`
    );
    fileEl.value = "";
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    uploadBtn.disabled = false;
  }
});
