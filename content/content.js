// ─── MESSAGE LISTENER ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scan_chat") {
    try {
      const result = extractContent();
      sendResponse(result);
    } catch (err) {
      sendResponse({ success: false, error: "Script error: " + err.message });
    }
  }
  return true; // Keep channel open for async
});

// ─── PLATFORM DETECTION ───────────────────────────────────────────────────────
function getPlatformName() {
  const h = window.location.hostname;
  if (h.includes("claude.ai")) return "Claude";
  if (h.includes("chatgpt.com")) return "ChatGPT";
  if (h.includes("gemini.google.com")) return "Gemini";
  return "Unknown";
}

// ─── MAIN EXTRACTION ──────────────────────────────────────────────────────────
function extractContent() {
  const platform = getPlatformName();

  // PHASE 1 ── Try structured DOM selectors (fast, gives clean output)
  const structured = getStructuredMessages(platform);
  if (structured.length >= 1) {
    const rawText = structured
      .map(m => `[${m.sender === "user" ? "USER" : "AI"}]:\n${m.text}`)
      .join("\n\n");
    return { success: true, rawText, messageCount: structured.length, platform };
  }

  // PHASE 2 ── Fall back to raw page text (works regardless of DOM changes)
  //            The AI in background.js will parse the conversation structure.
  const bodyText = getRawPageText();

  // Require at least 800 chars — empty chat pages are typically < 600 chars
  if (bodyText.length >= 800) {
    const est = Math.max(1, Math.round(
      bodyText.split("\n").filter(l => l.trim().length > 25).length / 4
    ));
    return { success: true, rawText: bodyText, messageCount: est, platform };
  }

  // Nothing found — user is probably on an empty/new chat page
  return {
    success: false,
    error:
      "No conversation detected.\n\n" +
      "Make sure you have an active conversation open " +
      "(not a new chat or home page)."
  };
}

// ─── PHASE 1: STRUCTURED SELECTORS PER PLATFORM ───────────────────────────────
function getStructuredMessages(platform) {
  if (platform === "ChatGPT") return scrapeGPT();
  if (platform === "Claude")  return scrapeClaude();
  if (platform === "Gemini")  return scrapeGemini();
  return [];
}

// ── ChatGPT ──
// [data-message-author-role] has been stable since 2023.
// Each message div carries this attribute regardless of class/layout changes.
function scrapeGPT() {
  const results = [];

  // Primary: data-message-author-role (very stable)
  const msgEls = document.querySelectorAll("[data-message-author-role]");
  if (msgEls.length > 0) {
    msgEls.forEach(el => {
      const role = el.getAttribute("data-message-author-role");
      const text = clean(el.innerText);
      if (text.length > 5) {
        results.push({ sender: role === "user" ? "user" : "ai", text });
      }
    });
    if (results.length > 0) return results;
  }

  // Fallback A: article[data-testid*="conversation-turn"]
  document.querySelectorAll("article").forEach((art, i) => {
    const text = clean(art.innerText);
    if (text.length > 10) {
      // Odd articles tend to be user, even tend to be AI — rough heuristic
      const userEl = art.querySelector("[data-message-author-role='user']");
      const aiEl   = art.querySelector("[data-message-author-role='assistant']");
      const sender  = userEl ? "user" : aiEl ? "ai" : (i % 2 === 0 ? "user" : "ai");
      results.push({ sender, text });
    }
  });

  return results;
}

// ── Claude.ai ──
// Claude changes DOM frequently. We try 4 known selector patterns.
function scrapeClaude() {
  const results = [];

  // Pattern 1: data-testid="human-turn" / "assistant-turn"  (current Claude)
  const turns = document.querySelectorAll(
    '[data-testid="human-turn"], [data-testid="assistant-turn"]'
  );
  if (turns.length > 0) {
    turns.forEach(t => {
      const isUser = t.getAttribute("data-testid") === "human-turn";
      const text = clean(t.innerText);
      if (text.length > 5) results.push({ sender: isUser ? "user" : "ai", text });
    });
    if (results.length > 0) return results;
  }

  // Pattern 2: font-user-message / font-claude-message  (older Claude)
  const fontEls = document.querySelectorAll(".font-user-message, .font-claude-message");
  if (fontEls.length > 0) {
    fontEls.forEach(el => {
      const isUser = el.classList.contains("font-user-message");
      const text = clean(el.innerText);
      if (text.length > 5) results.push({ sender: isUser ? "user" : "ai", text });
    });
    if (results.length > 0) return results;
  }

  // Pattern 3: data-testid contains "user" or "assistant"
  const testids = document.querySelectorAll("[data-testid*='user-message'], [data-testid*='assistant-message']");
  if (testids.length > 0) {
    testids.forEach(el => {
      const isUser = el.getAttribute("data-testid")?.includes("user");
      const text = clean(el.innerText);
      if (text.length > 5) results.push({ sender: isUser ? "user" : "ai", text });
    });
    if (results.length > 0) return results;
  }

  // Pattern 4: Look inside any element whose class contains "Human" or "Assistant"
  const allDivs = document.querySelectorAll("div, section");
  for (const div of allDivs) {
    const cls = (div.className || "").toLowerCase();
    if (cls.includes("human") || cls.includes("user-message") || cls.includes("usermessage")) {
      const text = clean(div.innerText);
      if (text.length > 5) results.push({ sender: "user", text });
    } else if (cls.includes("assistant") || cls.includes("ai-message") || cls.includes("bot-message")) {
      const text = clean(div.innerText);
      if (text.length > 5) results.push({ sender: "ai", text });
    }
  }

  return dedup(results);
}

// ── Gemini ──
function scrapeGemini() {
  const results = [];

  // Gemini uses custom web components — very stable
  const userEls = Array.from(document.querySelectorAll("user-query, .query-content"));
  const aiEls   = Array.from(document.querySelectorAll("model-response, .response-container-content, .markdown-main-panel"));

  if (userEls.length > 0 || aiEls.length > 0) {
    // Merge and sort by DOM position
    const combined = [
      ...userEls.map(el => ({ el, sender: "user" })),
      ...aiEls.map(el => ({ el, sender: "ai" }))
    ].sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    combined.forEach(({ el, sender }) => {
      const text = clean(el.innerText);
      if (text.length > 5) results.push({ sender, text });
    });
    return dedup(results);
  }

  // Fallback: class-based
  document.querySelectorAll("[class*='turn'], [class*='message']").forEach((el, i) => {
    const text = clean(el.innerText);
    if (text.length > 20) {
      results.push({ sender: i % 2 === 0 ? "user" : "ai", text });
    }
  });

  return dedup(results);
}

// ─── PHASE 2: RAW PAGE TEXT ───────────────────────────────────────────────────
function getRawPageText() {
  // Prefer <main> element — all chat platforms put the conversation there
  const root =
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.querySelector("[role='log']") ||
    document.body;

  let text = clean(root.innerText);

  // If main is too small, escalate to body
  if (text.length < 300 && root !== document.body) {
    text = clean(document.body.innerText);
  }

  // Keep only the LAST 25 000 chars (most recent messages)
  if (text.length > 25000) {
    text = "...[beginning of conversation trimmed]\n\n" + text.slice(text.length - 25000);
  }

  return text;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function clean(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{3,}/g, "  ")
    .trim();
}

// Remove near-duplicates (nested DOM elements captured twice)
function dedup(messages) {
  const seen = new Set();
  return messages.filter(m => {
    const key = m.text.slice(0, 60).trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
