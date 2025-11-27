
async function apiPostJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed with status ${res.status}: ${text}`);
  }

  return await res.json();
}

// Store last corrected sentence so we can compare spoken vs target
let lastCorrectedSentence = "";

function playFinnish(text) {
  if (!("speechSynthesis" in window)) {
    alert("Your browser does not support speech synthesis.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();
  const fiVoice =
    voices.find((v) => v.lang === "fi-FI") ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("fi"));

  if (fiVoice) {
    utterance.voice = fiVoice;
  }

  utterance.lang = "fi-FI";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function onFeedbackClick() {
  const sentenceEl = document.getElementById("sentence");
  const feedbackArea = document.getElementById("feedback-area");

  const sentence = sentenceEl.value.trim();
  if (!sentence) {
    feedbackArea.innerHTML = "<p>Please write a sentence first.</p>";
    return;
  }

  feedbackArea.innerHTML = "<p>Analyzing your sentence...</p>";

  try {
    const data = await apiPostJson("/api/correct", { sentence });

    if (data.error) {
      feedbackArea.innerHTML = `<p>Error: ${data.error}</p>`;
      return;
    }

    const {
      corrected,
      translation_en,
      explanations,
      pronunciation_guide,        // legacy fallback
      pronunciation_overview,
      pronunciation_breakdown,
      tone_feedback,
      verb_base,
      verb_meaning_en,
      verb_conjugation,
      verb_examples,
    } = data;

    lastCorrectedSentence = corrected || sentence; // fallback

    let html = "";

    html += `<p><strong>Corrected sentence (FI):</strong><br>${corrected}</p>`;
    html += `<p><button id="listen-btn">🔊 Listen</button></p>`;

    if (translation_en) {
      html += `<p><strong>Translation (EN):</strong><br>${translation_en}</p>`;
    }
if (Array.isArray(explanations) && explanations.length > 0) {
  html += "<p><strong>Grammar / usage notes:</strong></p><ul>";
  explanations.forEach((exp) => {
    if (!exp) return;
    const text = String(exp);
    let formatted = text;

    const colonIndex = text.indexOf(":");
    if (colonIndex > 0) {
      const key = text.slice(0, colonIndex).trim();
      const rest = text.slice(colonIndex + 1).trim();

      // Escape key for regex
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Bold the Finnish word also inside the explanation text
      const restHighlighted = rest.replace(
        new RegExp(`\\b(${escapedKey})\\b`, "gi"),
        "<strong>$1</strong>"
      );

      formatted = `<strong>${key}:</strong> ${restHighlighted}`;
    }

    html += `<li>${formatted}</li>`;
  });
  html += "</ul>";
}



    // Pronunciation overview + per-word breakdown
    const overview = pronunciation_overview || pronunciation_guide || "";

    if (overview) {
      html += `<p><strong>Pronunciation hints (overview):</strong><br>${overview}</p>`;
    }

    if (Array.isArray(pronunciation_breakdown) && pronunciation_breakdown.length > 0) {
      html += "<p><strong>Pronunciation by word/part:</strong></p><ul>";
      pronunciation_breakdown.forEach((item) => {
        if (!item.part && !item.tip) return;
        const part = item.part || "";
        const tip = item.tip || "";
        html += `<li><strong>${part}:</strong> ${tip}</li>`;
      });
      html += "</ul>";
    }

    if (tone_feedback) {
      html += `<p><em>${tone_feedback}</em></p>`;
    }

    // Verb practice section (table layout)
    if (verb_base) {
      const label = verb_meaning_en
        ? `${verb_base} – ${verb_meaning_en}`
        : verb_base;

      html += `<hr><p><strong>Verb practice:</strong> ${label}</p>`;

      // Build rows by index: each row = person + form + example (if available)
      const rows = [];
      const conj = Array.isArray(verb_conjugation) ? verb_conjugation : [];
      const exs = Array.isArray(verb_examples) ? verb_examples : [];
      const maxLen = Math.max(conj.length, exs.length);

      for (let i = 0; i < maxLen; i++) {
        const c = conj[i] || {};
        const e = exs[i] || {};
        rows.push({
          person: c.person || "",
          form: c.form || "",
          exFi: e.fi || "",
          exEn: e.en || "",
        });
      }

      html += `
        <table class="verb-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Verb form</th>
              <th>Example (FI)</th>
              <th>Example (EN)</th>
            </tr>
          </thead>
          <tbody>
      `;

      rows.forEach((row) => {
        // Skip completely empty rows
        if (!row.person && !row.form && !row.exFi && !row.exEn) return;

        html += `
          <tr>
            <td>${row.person}</td>
            <td>${row.form}</td>
            <td>${row.exFi}</td>
            <td><em>${row.exEn}</em></td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    feedbackArea.innerHTML = html;

    const listenBtn = document.getElementById("listen-btn");
    if (listenBtn) {
      listenBtn.addEventListener("click", () => playFinnish(corrected));
    }
  } catch (err) {
    console.error(err);
    feedbackArea.innerHTML =
      "<p>Something went wrong while getting feedback.</p>";
  }
}

// ------- SPEAK & CHECK PRONUNCIATION -------

function startPronunciationCheck() {
  const statusEl = document.getElementById("speech-status");
  const pronFeedback = document.getElementById("pronunciation-feedback");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    statusEl.textContent =
      "Your browser does not support speech recognition. Try Chrome.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "fi-FI";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  statusEl.textContent = "Listening... please speak your sentence.";

  recognition.onresult = async (event) => {
    const spoken = event.results[0][0].transcript;
    statusEl.textContent = `You said (recognized): "${spoken}"`;

    const target =
      lastCorrectedSentence ||
      document.getElementById("sentence").value.trim();

    if (!target) {
      pronFeedback.innerHTML =
        "<p>Please get text feedback first (or write a sentence) before pronunciation check.</p>";
      return;
    }

    pronFeedback.innerHTML = "<p>Analyzing your pronunciation...</p>";

    try {
      const data = await apiPostJson("/api/pronunciation-eval", {
        target,
        spoken,
      });

      if (data.error) {
        pronFeedback.innerHTML = `<p>Error: ${data.error}</p>`;
        return;
      }

      const { match_quality, overall_comment, problem_words } = data;

      let html = "";
      if (match_quality) {
        html += `<p><strong>Match quality:</strong> ${match_quality}</p>`;
      }
      if (overall_comment) {
        html += `<p><strong>Overall comment:</strong><br>${overall_comment}</p>`;
      }
      if (Array.isArray(problem_words) && problem_words.length > 0) {
        html += "<p><strong>Words to practice:</strong></p><ul>";
        problem_words.forEach((item) => {
          html += `<li><strong>${item.word}:</strong> ${item.tip}</li>`;
        });
        html += "</ul>";
      }

      pronFeedback.innerHTML = html || "<p>No detailed feedback returned.</p>";
    } catch (err) {
      console.error(err);
      pronFeedback.innerHTML =
        "<p>Something went wrong while analyzing pronunciation.</p>";
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    statusEl.textContent = "Speech recognition error: " + event.error;
  };

  recognition.onend = () => {
    if (!statusEl.textContent.startsWith("You said")) {
      statusEl.textContent = "Stopped listening.";
    }
  };

  recognition.start();
}

function resetFormAndFeedback() {
  const sentenceEl = document.getElementById("sentence");
  const feedbackArea = document.getElementById("feedback-area");
  const pronFeedback = document.getElementById("pronunciation-feedback");
  const statusEl = document.getElementById("speech-status");

  if (sentenceEl) {
    sentenceEl.value = "";
  }

  if (feedbackArea) {
    feedbackArea.innerHTML =
      "<p>No feedback yet. Write a sentence and click the button.</p>";
  }

  if (pronFeedback) {
    pronFeedback.innerHTML = "<p>No pronunciation check yet.</p>";
  }

  if (statusEl) {
    statusEl.textContent = "";
  }

  // Clear last sentence and stop any ongoing speech
  lastCorrectedSentence = "";
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("feedback-btn");
  if (btn) {
    btn.addEventListener("click", onFeedbackClick);
  }

  const pronounceBtn = document.getElementById("pronounce-btn");
  if (pronounceBtn) {
    pronounceBtn.addEventListener("click", startPronunciationCheck);
  }

  const resetBtn = document.getElementById("reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetFormAndFeedback);
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
});
