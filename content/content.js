// ─── MESSAGE LISTENER ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scan_chat") {
    // Run async so we can scroll + wait
    extractContentAsync()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: "Script error: " + err.message }));
    return true; // Keep channel open for async
  }
});

// ─── PLATFORM DETECTION ───────────────────────────────────────────────────────
function getPlatformName() {
  const h = window.location.hostname;
  if (h.includes("claude.ai"))          return "Claude";
  if (h.includes("chatgpt.com"))        return "ChatGPT";
  if (h.includes("gemini.google.com")) return "Gemini";
  return "Unknown";
}

// ─── MAIN EXTRACTION (async) ──────────────────────────────────────────────────
async function extractContentAsync() {
  const platform = getPlatformName();

  // ── Step 1: For Claude specifically, try the internal API first (100% accurate) ──
  if (platform === "Claude") {
    const apiResult = await tryClaudeAPI();
    if (apiResult) return apiResult;
  }

  // ── Step 2: Scroll entire conversation into DOM (defeats virtualized rendering) ──
  await scrollConversationIntoView(platform);

  // ── Step 3: Structured DOM scraping ──
  const structured = getStructuredMessages(platform);
  if (structured.length >= 2) {
    const rawText = structured
      .map(m => `[${m.sender === "user" ? "USER" : "AI"}]:\n${m.text}`)
      .join("\n\n");
    return { success: true, rawText, messageCount: structured.length, platform };
  }

  // ── Step 4: Raw page text fallback ──
  const bodyText = getRawPageText();
  if (bodyText.length >= 500) {
    const est = Math.max(1, Math.round(
      bodyText.split("\n").filter(l => l.trim().length > 25).length / 4
    ));
    return { success: true, rawText: bodyText, messageCount: est, platform };
  }

  return {
    success: false,
    error:
      "No conversation detected.\n\n" +
      "Make sure you have an active conversation open " +
      "(not a new chat or home page)."
  };
}

// ─── CLAUDE INTERNAL API ──────────────────────────────────────────────────────
// Claude exposes its conversation data via an internal REST endpoint.
// This is the most reliable method — gives 100% of messages regardless of scroll.
async function tryClaudeAPI() {
  try {
    // Extract conversation ID from URL: /chat/<uuid>
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const chatIdx = pathParts.indexOf("chat");
    const conversationId = chatIdx >= 0 ? pathParts[chatIdx + 1] : null;
    if (!conversationId || conversationId.length < 10) return null;

    // Org ID is stored in a cookie
    const orgMatch = document.cookie.match(/lastActiveOrg=([^;]+)/);
    const orgId = orgMatch ? orgMatch[1] : null;
    if (!orgId) return null;

    const url = `/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=true&rendering_mode=messages&render_all_tools=true`;
    const resp = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data?.chat_messages || data.chat_messages.length === 0) return null;

    const messages = [];
    for (const msg of data.chat_messages) {
      const sender = msg.sender === "human" ? "user" : "ai";
      // Content is an array of content blocks
      let text = "";
      if (Array.isArray(msg.content)) {
        text = msg.content
          .filter(c => c.type === "text" && c.text)
          .map(c => c.text)
          .join("\n")
          .trim();
      }
      if (text.length > 2) {
        messages.push({ sender, text });
      }
    }

    if (messages.length < 1) return null;

    const rawText = messages
      .map(m => `[${m.sender === "user" ? "USER" : "AI"}]:\n${m.text}`)
      .join("\n\n");

    return { success: true, rawText, messageCount: messages.length, platform: "Claude" };
  } catch (e) {
    console.warn("The Context: Claude API fetch failed:", e.message);
    return null;
  }
}

// ─── SCROLL-TO-LOAD (defeats virtualized rendering) ──────────────────────────
// Many chat platforms only render messages that are in the viewport.
// We scroll up to the top so all messages get loaded into the DOM.
async function scrollConversationIntoView(platform) {
  try {
    // Find the scrollable conversation container
    const scroller = findScrollContainer(platform);
    if (!scroller) return;

    const MAX_SCROLL_MS = 4000; // max 4 seconds to scroll
    const STEP_MS       = 150;
    const start         = Date.now();

    // Scroll to top in steps (triggering lazy-load on the way up)
    let prevTop = Infinity;
    while (Date.now() - start < MAX_SCROLL_MS) {
      scroller.scrollTop = 0;
      await sleep(STEP_MS);
      const curTop = scroller.scrollTop;
      if (curTop === 0 || curTop >= prevTop) break; // reached top or stuck
      prevTop = curTop;
    }

    // Give DOM a moment to settle after scrolling
    await sleep(300);

    // Scroll back to bottom so user sees the latest messages
    scroller.scrollTop = scroller.scrollHeight;
  } catch (e) {
    // Ignore scroll errors — non-fatal
  }
}

function findScrollContainer(platform) {
  // Platform-specific hints first
  const candidates = [];

  if (platform === "Claude") {
    candidates.push(
      document.querySelector('[data-testid="conversation-content"]'),
      document.querySelector(".conversation-content"),
      document.querySelector("main .overflow-y-auto"),
      document.querySelector("main .overflow-y-scroll"),
    );
  } else if (platform === "ChatGPT") {
    candidates.push(
      document.querySelector("[data-testid='conversation-turns']"),
      document.querySelector("main .overflow-y-auto"),
      document.querySelector("main .overflow-y-scroll"),
    );
  } else if (platform === "Gemini") {
    candidates.push(
      document.querySelector("infinite-scroller"),
      document.querySelector(".conversation-container"),
      document.querySelector("chat-window"),
    );
  }

  // Generic fallback: find the deepest element that's taller than viewport
  candidates.push(
    document.querySelector("main"),
    document.querySelector("[role='main']"),
    document.querySelector("[role='log']")
  );

  for (const el of candidates) {
    if (el && el.scrollHeight > el.clientHeight + 50) return el;
  }

  // Last resort: find any div that scrolls
  for (const el of document.querySelectorAll("div")) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 100 &&
        el.clientHeight > 200) {
      return el;
    }
  }
  return null;
}

// ─── PHASE 1: STRUCTURED SELECTORS PER PLATFORM ───────────────────────────────
function getStructuredMessages(platform) {
  if (platform === "ChatGPT") return scrapeGPT();
  if (platform === "Claude")  return scrapeClaude();
  if (platform === "Gemini")  return scrapeGemini();
  return [];
}

// ══ ChatGPT ══════════════════════════════════════════════════════════════════
// [data-message-author-role] has been stable since 2023.
function scrapeGPT() {
  const results = [];

  // Strategy 1: data-message-author-role (very stable attribute)
  const msgEls = document.querySelectorAll("[data-message-author-role]");
  if (msgEls.length > 0) {
    msgEls.forEach(el => {
      const role = el.getAttribute("data-message-author-role");
      const text = cleanText(el.innerText);
      if (text.length > 5) {
        results.push({ sender: role === "user" ? "user" : "ai", text });
      }
    });
    if (results.length > 0) return dedup(results);
  }

  // Strategy 2: article[data-testid*="conversation-turn"]
  const articles = document.querySelectorAll("article[data-testid]");
  if (articles.length > 0) {
    articles.forEach(art => {
      const testid = art.getAttribute("data-testid") || "";
      const isUser = testid.includes("user");
      const isAI   = testid.includes("assistant");
      const text   = cleanText(art.innerText);
      if (text.length > 5) {
        const sender = isUser ? "user" : isAI ? "ai" : null;
        if (sender) results.push({ sender, text });
      }
    });
    if (results.length > 0) return dedup(results);
  }

  // Strategy 3: role="presentation" children with author role children (new layout)
  document.querySelectorAll("[data-testid^='conversation-turn']").forEach(turn => {
    const userEl = turn.querySelector("[data-message-author-role='user']");
    const aiEl   = turn.querySelector("[data-message-author-role='assistant']");
    if (userEl) {
      const text = cleanText(userEl.innerText);
      if (text.length > 5) results.push({ sender: "user", text });
    }
    if (aiEl) {
      const text = cleanText(aiEl.innerText);
      if (text.length > 5) results.push({ sender: "ai", text });
    }
  });

  return dedup(results);
}

// ══ Claude.ai ════════════════════════════════════════════════════════════════
// Claude changes DOM frequently. We try several known patterns.
// Note: The internal API (tryClaudeAPI) is tried first before this function.
function scrapeClaude() {
  const results = [];

  // ── Pattern 1: data-testid="human-turn" / "assistant-turn" (current Claude)
  const turns = document.querySelectorAll(
    '[data-testid="human-turn"], [data-testid="assistant-turn"]'
  );
  if (turns.length > 0) {
    turns.forEach(t => {
      const isUser = t.getAttribute("data-testid") === "human-turn";
      const text = cleanText(t.innerText);
      if (text.length > 5) results.push({ sender: isUser ? "user" : "ai", text });
    });
    if (results.length > 0) return dedup(results);
  }

  // ── Pattern 2: Newer Claude uses data-testid on message wrappers differently
  // Try: [data-testid*="message"] containers with role indicators
  const msgWrappers = document.querySelectorAll(
    '[data-testid*="message"], [data-testid*="turn"]'
  );
  if (msgWrappers.length > 0) {
    const seen = new Set();
    msgWrappers.forEach(el => {
      const testid = el.getAttribute("data-testid") || "";
      // Skip buttons, spans, and tiny elements
      if (el.clientHeight < 20) return;
      const text = cleanText(el.innerText);
      if (text.length < 5) return;
      const key = text.slice(0, 100);
      if (seen.has(key)) return;
      seen.add(key);
      const isUser = testid.includes("human") || testid.includes("user");
      const isAI   = testid.includes("assistant") || testid.includes("claude");
      if (isUser) results.push({ sender: "user", text });
      else if (isAI) results.push({ sender: "ai", text });
    });
    if (results.length >= 2) return dedup(results);
  }

  // ── Pattern 3: font-user-message / font-claude-message (older Claude)
  const fontEls = document.querySelectorAll(".font-user-message, .font-claude-message");
  if (fontEls.length > 0) {
    fontEls.forEach(el => {
      const isUser = el.classList.contains("font-user-message");
      const text = cleanText(el.innerText);
      if (text.length > 5) results.push({ sender: isUser ? "user" : "ai", text });
    });
    if (results.length > 0) return dedup(results);
  }

  // ── Pattern 4: Look for the conversation feed structure
  // Claude wraps messages in a scrollable list — find the parent container
  const feedSelectors = [
    '[data-testid="conversation-content"]',
    ".conversation-content",
    "main [class*='conversation']",
    "[class*='ChatMessages']",
    "[class*='MessageList']",
  ];

  for (const sel of feedSelectors) {
    const feed = document.querySelector(sel);
    if (!feed) continue;

    // Inside the feed, look for alternating message blocks
    const blocks = Array.from(feed.children).filter(c =>
      c.tagName !== "SCRIPT" && c.tagName !== "STYLE" && c.clientHeight > 30
    );

    if (blocks.length >= 2) {
      blocks.forEach((block, i) => {
        const text = cleanText(block.innerText);
        if (text.length > 10) {
          // Heuristic: first block is user, alternates; or check for visual cues
          const hasUserCue = block.querySelector("[data-testid*='human'], [class*='user']");
          const hasAICue   = block.querySelector("[data-testid*='assistant'], [class*='claude'], [class*='assistant']");
          const sender = hasUserCue ? "user" : hasAICue ? "ai" : (i % 2 === 0 ? "user" : "ai");
          results.push({ sender, text });
        }
      });
      if (results.length >= 2) return dedup(results);
    }
  }

  // ── Pattern 5: Broad class-based scan (last resort for Claude)
  // Only look at elements of sufficient size to avoid nav/sidebar junk
  const allDivs = document.querySelectorAll("div[class], section[class]");
  const candidates = [];
  for (const div of allDivs) {
    const cls = (div.className || "").toLowerCase();
    if (div.clientHeight < 40 || div.clientWidth < 200) continue;
    if (cls.includes("human") || cls.includes("user-message") || cls.includes("usermessage")) {
      const text = cleanText(div.innerText);
      if (text.length > 5) candidates.push({ sender: "user", text, el: div });
    } else if (cls.includes("assistant") || cls.includes("ai-message") || cls.includes("claude-message")) {
      const text = cleanText(div.innerText);
      if (text.length > 5) candidates.push({ sender: "ai", text, el: div });
    }
  }

  // Remove candidates that are ancestors of other candidates (take innermost)
  const filtered = candidates.filter(c =>
    !candidates.some(other => other !== c && c.el.contains(other.el))
  );
  filtered.forEach(c => results.push({ sender: c.sender, text: c.text }));

  return dedup(results);
}

// ══ Gemini ═══════════════════════════════════════════════════════════════════
// Gemini uses custom web components — relatively stable but can change.
function scrapeGemini() {
  const results = [];

  // ── Strategy 1: Custom web components (most stable)
  const userEls = Array.from(document.querySelectorAll(
    "user-query, .query-content, [data-turn-role='user']"
  ));
  const aiEls   = Array.from(document.querySelectorAll(
    "model-response, .response-container-content, .markdown-main-panel, [data-turn-role='model']"
  ));

  if (userEls.length > 0 || aiEls.length > 0) {
    const combined = [
      ...userEls.map(el => ({ el, sender: "user" })),
      ...aiEls.map(el  => ({ el, sender: "ai" }))
    ].sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    combined.forEach(({ el, sender }) => {
      const text = cleanText(el.innerText);
      if (text.length > 5) results.push({ sender, text });
    });
    if (results.length > 0) return dedup(results);
  }

  // ── Strategy 2: conversation-turn elements with role attributes
  const turns = document.querySelectorAll("[data-turn-role], [class*='conversation-turn']");
  if (turns.length > 0) {
    turns.forEach(turn => {
      const role = turn.getAttribute("data-turn-role");
      const cls  = (turn.className || "").toLowerCase();
      const isUser = role === "user" || cls.includes("user");
      const isAI   = role === "model" || role === "assistant" || cls.includes("model");
      const text = cleanText(turn.innerText);
      if (text.length > 5) {
        if (isUser) results.push({ sender: "user", text });
        else if (isAI) results.push({ sender: "ai", text });
      }
    });
    if (results.length >= 2) return dedup(results);
  }

  // ── Strategy 3: Look inside <infinite-scroller> or <chat-window>
  const chatContainer = document.querySelector("infinite-scroller, chat-window, .chat-history");
  if (chatContainer) {
    const children = Array.from(chatContainer.querySelectorAll(
      "user-query, model-response, [class*='query'], [class*='response']"
    ));
    children.forEach((el, i) => {
      const text = cleanText(el.innerText);
      if (text.length > 5) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className || "").toLowerCase();
        const isUser = tag === "user-query" || cls.includes("query");
        results.push({ sender: isUser ? "user" : "ai", text });
      }
    });
    if (results.length >= 2) return dedup(results);
  }

  // ── Strategy 4: aria-label based (fallback)
  document.querySelectorAll("[aria-label*='conversation'], [role='listitem']").forEach((el, i) => {
    const text = cleanText(el.innerText);
    if (text.length > 20) {
      results.push({ sender: i % 2 === 0 ? "user" : "ai", text });
    }
  });

  // ── Strategy 5: Broad class scan for Gemini
  if (results.length < 2) {
    document.querySelectorAll("[class*='turn'], [class*='message'], [class*='bubble']").forEach((el, i) => {
      if (el.clientHeight < 30) return;
      const text = cleanText(el.innerText);
      if (text.length > 20) {
        results.push({ sender: i % 2 === 0 ? "user" : "ai", text });
      }
    });
  }

  return dedup(results);
}

// ─── PHASE 2: RAW PAGE TEXT ───────────────────────────────────────────────────
function getRawPageText() {
  // Prefer <main> element
  const root =
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.querySelector("[role='log']") ||
    document.body;

  let text = cleanText(root.innerText);

  if (text.length < 300 && root !== document.body) {
    text = cleanText(document.body.innerText);
  }

  // Keep only the LAST 25 000 chars (most recent messages)
  if (text.length > 25000) {
    text = "...[beginning of conversation trimmed]\n\n" + text.slice(text.length - 25000);
  }

  return text;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{3,}/g, "  ")
    .trim();
}

// Remove near-duplicates (nested DOM elements captured twice).
// Uses full text length + first 120 chars as key for accuracy.
function dedup(messages) {
  const seen = new Set();
  const out  = [];

  for (const m of messages) {
    // Key = sender + text length bucket + first 120 chars
    const key = `${m.sender}|${Math.floor(m.text.length / 20)}|${m.text.slice(0, 120).trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }

  // Secondary pass: if any message text fully contains another, keep longer one
  return out.filter((m, i) =>
    !out.some((other, j) =>
      j !== i && other.sender === m.sender &&
      other.text.length > m.text.length &&
      other.text.includes(m.text)
    )
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
