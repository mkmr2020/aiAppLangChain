const form = document.getElementById("askForm");
const questionInput = document.getElementById("question");
const sendBtn = document.getElementById("sendBtn");
const responseEl = document.getElementById("response");

function setResponse(text) {
  responseEl.textContent = text;
}

function setBusy(isBusy) {
  questionInput.disabled = isBusy;
  sendBtn.disabled = isBusy;
}

setResponse("Enter a question to get started.");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = questionInput.value.trim();
  if (!question) return;

  setBusy(true);
  setResponse("Thinking...");

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResponse(data.error || "Request failed.");
      return;
    }

    setResponse(data.answer || "");
  } catch (err) {
    setResponse(err instanceof Error ? err.message : String(err));
  } finally {
    setBusy(false);
    questionInput.focus();
    questionInput.select();
  }
});
