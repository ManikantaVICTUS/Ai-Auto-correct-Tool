const sourceText = document.querySelector("#sourceText");
const correctedText = document.querySelector("#correctedText");
const suggestionsList = document.querySelector("#suggestionsList");
const analyzeButton = document.querySelector("#analyzeButton");
const applyAllButton = document.querySelector("#applyAllButton");
const sampleButton = document.querySelector("#sampleButton");
const copyButton = document.querySelector("#copyButton");
const dictionaryForm = document.querySelector("#dictionaryForm");
const dictionaryInput = document.querySelector("#dictionaryInput");
const issueCount = document.querySelector("#issueCount");
const autoCount = document.querySelector("#autoCount");
const fluencyScore = document.querySelector("#fluencyScore");
const statusPill = document.querySelector("#statusPill");

const sampleText = "I recieve your mesage and I will reply tommorow. Their is alot of things we can improve in this tool. Please dont change my productname because its our brand.";

const spellingRules = new Map([
  ["teh", "the"],
  ["recieve", "receive"],
  ["recieved", "received"],
  ["mesage", "message"],
  ["tommorow", "tomorrow"],
  ["adress", "address"],
  ["seperate", "separate"],
  ["definately", "definitely"],
  ["occured", "occurred"],
  ["beleive", "believe"],
  ["wich", "which"],
  ["becuase", "because"],
  ["dont", "don't"],
  ["cant", "can't"],
  ["wont", "won't"],
  ["im", "I'm"],
  ["alot", "a lot"]
]);

const grammarPatterns = [
  {
    pattern: /\bTheir is\b/gi,
    replacement: "There are",
    type: "grammar",
    reason: "Uses the correct phrase and plural verb for the sentence context.",
    confidence: "medium"
  },
  {
    pattern: /\bThere is ([a-z]+s)\b/gi,
    replacement: "There are $1",
    type: "grammar",
    reason: 'Plural nouns usually pair with "are".',
    confidence: "medium"
  },
  {
    pattern: /\bI has\b/gi,
    replacement: "I have",
    type: "grammar",
    reason: 'First-person subject uses "have".',
    confidence: "high"
  },
  {
    pattern: /\bmore better\b/gi,
    replacement: "better",
    type: "fluency",
    reason: "Removes a redundant comparative.",
    confidence: "high"
  },
  {
    pattern: /\bvery unique\b/gi,
    replacement: "unique",
    type: "fluency",
    reason: "Tightens wording while preserving meaning.",
    confidence: "medium"
  }
];

let personalDictionary = new Set(JSON.parse(localStorage.getItem("personalDictionary") || "[]"));
let ignoredCorrections = new Set();
let currentSuggestions = [];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function preserveCase(original, replacement) {
  if (original.toUpperCase() === original) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function getReplacementRanges(text) {
  const ranges = [];

  for (const [wrong, right] of spellingRules) {
    if (personalDictionary.has(wrong.toLowerCase())) continue;
    const regex = new RegExp(`\\b${wrong}\\b`, "gi");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const original = match[0];
      const replacement = preserveCase(original, right);
      const key = `${match.index}:${original}:${replacement}`;
      if (ignoredCorrections.has(key)) continue;
      ranges.push({
        id: key,
        start: match.index,
        end: match.index + original.length,
        original,
        replacement,
        confidence: "high",
        type: "spelling",
        reason: "Corrects a common typing or spelling error."
      });
    }
  }

  for (const rule of grammarPatterns) {
    let match;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const original = match[0];
      const replacement = original.replace(rule.pattern, rule.replacement);
      const key = `${match.index}:${original}:${replacement}`;
      if (ignoredCorrections.has(key)) continue;
      ranges.push({
        id: key,
        start: match.index,
        end: match.index + original.length,
        original,
        replacement,
        confidence: rule.confidence,
        type: rule.type,
        reason: rule.reason
      });
    }
  }

  return ranges.sort((a, b) => a.start - b.start).filter((item, index, list) => {
    const previous = list[index - 1];
    return !previous || item.start >= previous.end;
  });
}

function applySuggestions(text, suggestions, confidenceFilter = null) {
  let output = "";
  let cursor = 0;
  const applied = [];

  for (const suggestion of suggestions) {
    output += text.slice(cursor, suggestion.start);
    const shouldApply = !confidenceFilter || suggestion.confidence === confidenceFilter;
    if (shouldApply) {
      output += suggestion.replacement;
      applied.push(suggestion);
    } else {
      output += text.slice(suggestion.start, suggestion.end);
    }
    cursor = suggestion.end;
  }

  output += text.slice(cursor);
  return { output, applied };
}

function renderMarkedText(text, suggestions) {
  let html = "";
  let cursor = 0;

  for (const suggestion of suggestions) {
    html += escapeHtml(text.slice(cursor, suggestion.start));
    const className = suggestion.confidence === "high" ? "mark-high" : "mark-medium";
    html += `<span class="mark ${className}" title="${escapeHtml(suggestion.original)} -> ${escapeHtml(suggestion.replacement)}">${escapeHtml(suggestion.replacement)}</span>`;
    cursor = suggestion.end;
  }

  html += escapeHtml(text.slice(cursor));
  correctedText.innerHTML = html || "Your corrected text will appear here.";
}

function renderSuggestions() {
  if (currentSuggestions.length === 0) {
    suggestionsList.innerHTML = '<div class="empty">No issues found. The text looks clean.</div>';
    return;
  }

  suggestionsList.innerHTML = currentSuggestions.map((suggestion) => `
    <article class="suggestion">
      <div>
        <div class="suggestion-title">
          <span>${escapeHtml(suggestion.original)} -> ${escapeHtml(suggestion.replacement)}</span>
          <span class="tag tag-${suggestion.confidence}">${suggestion.confidence}</span>
          <span class="tag tag-medium">${suggestion.type}</span>
        </div>
        <p>${escapeHtml(suggestion.reason)}</p>
      </div>
      <div class="suggestion-actions">
        <button class="mini" type="button" data-action="accept" data-id="${escapeHtml(suggestion.id)}">Accept</button>
        <button class="mini danger" type="button" data-action="ignore" data-id="${escapeHtml(suggestion.id)}">Ignore</button>
      </div>
    </article>
  `).join("");
}

function updateMetrics() {
  const highConfidence = currentSuggestions.filter((item) => item.confidence === "high").length;
  issueCount.textContent = String(currentSuggestions.length);
  autoCount.textContent = String(highConfidence);
  fluencyScore.textContent = String(Math.max(0, 100 - currentSuggestions.length * 8));
  applyAllButton.disabled = highConfidence === 0;
}

function analyze() {
  currentSuggestions = getReplacementRanges(sourceText.value);
  renderMarkedText(sourceText.value, currentSuggestions);
  renderSuggestions();
  updateMetrics();
  statusPill.textContent = currentSuggestions.length ? "Reviewing" : "Clean";
}

function replaceSingleSuggestion(id) {
  const suggestion = currentSuggestions.find((item) => item.id === id);
  if (!suggestion) return;
  sourceText.value = `${sourceText.value.slice(0, suggestion.start)}${suggestion.replacement}${sourceText.value.slice(suggestion.end)}`;
  analyze();
}

function saveDictionary() {
  localStorage.setItem("personalDictionary", JSON.stringify([...personalDictionary]));
}

analyzeButton.addEventListener("click", analyze);
sourceText.addEventListener("input", () => {
  window.clearTimeout(sourceText.analysisTimer);
  sourceText.analysisTimer = window.setTimeout(analyze, 240);
});

applyAllButton.addEventListener("click", () => {
  const result = applySuggestions(sourceText.value, currentSuggestions, "high");
  sourceText.value = result.output;
  statusPill.textContent = `Applied ${result.applied.length}`;
  analyze();
});

suggestionsList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "accept") {
    replaceSingleSuggestion(id);
  }
  if (button.dataset.action === "ignore") {
    ignoredCorrections.add(id);
    analyze();
  }
});

dictionaryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const word = dictionaryInput.value.trim().toLowerCase();
  if (!word) return;
  personalDictionary.add(word);
  saveDictionary();
  dictionaryInput.value = "";
  statusPill.textContent = "Learned";
  analyze();
});

sampleButton.addEventListener("click", () => {
  sourceText.value = sampleText;
  ignoredCorrections = new Set();
  analyze();
});

copyButton.addEventListener("click", async () => {
  const result = applySuggestions(sourceText.value, currentSuggestions);
  await navigator.clipboard.writeText(result.output);
  statusPill.textContent = "Copied";
});

analyze();
