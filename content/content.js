// ─── THE CONTEXT — CONTENT SCRIPT ─────────────────────────────────────────────
// Multi-Platform Conversation Scraper Engine

// ─── MESSAGE LISTENER ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scan_chat") {
    extractContentAsync()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: "Scan error: " + err.message }));
    return true; // Keep channel open for async
  }
});

// ─── PLATFORM DETECTION ───────────────────────────────────────────────────────
function getPlatformName() {
  const h = window.location.hostname.toLowerCase();
  if (h.includes("claude.ai")) return "Claude";
  if (h.includes("chatgpt.com") || h.includes("chat.openai.com")) return "ChatGPT";
  if (h.includes("gemini.google.com")) return "Gemini";
  if (h.includes("deepseek.com")) return "DeepSeek";
  if (h.includes("perplexity.ai")) return "Perplexity";
  if (h.includes("mistral.ai")) return "Mistral";
  if (h.includes("copilot.microsoft")) return "Copilot";
  if (h.includes("grok.com") || (h.includes("x.com") && window.location.pathname.includes("/grok"))) return "Grok";
  if (h.includes("poe.com")) return "Poe";
  if (h.includes("huggingface.co")) return "HuggingChat";
  return "AI Chat";
}

// ─── MAIN ASYNC EXTRACTION ────────────────────────────────────────────────────
async function extractContentAsync() {
  const platform = getPlatformName();

  // Step 1: For Claude, test if internal API is available
  if (platform === "Claude") {
    const apiResult = await tryClaudeAPI();
    if (apiResult && apiResult.messages && apiResult.messages.length >= 2) {
      return apiResult;
    }
  }

  // Step 2: Structured DOM scraping for active platform
  const structuredMessages = getStructuredMessages(platform);

  if (structuredMessages && structuredMessages.length >= 1) {
    const enrichedMessages = structuredMessages.map((m, i) => {
      const idx = i + 1;
      const preview = m.text.length > 90 ? m.text.slice(0, 90).trim() + "..." : m.text.trim();
      return {
        id: idx,
        index: idx,
        sender: m.sender,
        text: m.text,
        preview: preview,
        wordCount: m.text.split(/\s+/).filter(Boolean).length
      };
    });

    const rawText = enrichedMessages
      .map(m => `[${m.sender === "user" ? "USER" : "AI"}]:\n${m.text}`)
      .join("\n\n");

    return {
      success: true,
      rawText,
      messageCount: enrichedMessages.length,
      messages: enrichedMessages,
      platform
    };
  }

  // Step 3: Generic Fallback (Raw Page Text)
  const bodyText = getRawPageText();
  if (bodyText.length >= 300) {
    const rawBlocks = bodyText.split(/\n\n+/).filter(b => b.trim().length > 30);
    const fallbackMessages = rawBlocks.slice(0, 100).map((b, i) => ({
      id: i + 1,
      index: i + 1,
      sender: i % 2 === 0 ? "user" : "ai",
      text: b.trim(),
      preview: b.slice(0, 90).trim() + "...",
      wordCount: b.split(/\s+/).filter(Boolean).length
    }));

    return {
      success: true,
      rawText: bodyText,
      messageCount: Math.max(1, fallbackMessages.length),
      messages: fallbackMessages,
      platform
    };
  }

  return {
    success: false,
    error: "No active conversation detected on this page. Please make sure you are inside an active chat session."
  };
}

// ─── CLAUDE REST API FALLBACK ─────────────────────────────────────────────────
async function tryClaudeAPI() {
  try {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const chatIdx = pathParts.indexOf("chat");
    const conversationId = chatIdx >= 0 ? pathParts[chatIdx + 1] : null;
    if (!conversationId || conversationId.length < 10) return null;

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

    const enrichedMessages = messages.map((m, i) => ({
      id: i + 1,
      index: i + 1,
      sender: m.sender,
      text: m.text,
      preview: m.text.length > 90 ? m.text.slice(0, 90).trim() + "..." : m.text.trim(),
      wordCount: m.text.split(/\s+/).filter(Boolean).length
    }));

    const rawText = enrichedMessages
      .map(m => `[${m.sender === "user" ? "USER" : "AI"}]:\n${m.text}`)
      .join("\n\n");

    return {
      success: true,
      rawText,
      messageCount: enrichedMessages.length,
      messages: enrichedMessages,
      platform: "Claude"
    };
  } catch (e) {
    return null;
  }
}


// ─── PLATFORM-SPECIFIC MESSAGE SCRAPERS ───────────────────────────────────────
function getStructuredMessages(platform) {
  let list = [];
  switch (platform) {
    case "ChatGPT":
      list = scrapeChatGPT();
      break;
    case "Claude":
      list = scrapeClaude();
      break;
    case "Gemini":
      list = scrapeGemini();
      break;
    case "DeepSeek":
      list = scrapeDeepSeek();
      break;
    case "Perplexity":
      list = scrapePerplexity();
      break;
    case "Mistral":
      list = scrapeMistral();
      break;
    case "Copilot":
      list = scrapeCopilot();
      break;
    case "Grok":
      list = scrapeGrok();
      break;
    case "Poe":
      list = scrapePoe();
      break;
    default:
      list = scrapeUniversal();
  }

  if (!list || list.length === 0) {
    list = scrapeUniversal();
  }

  return dedupAndOrder(list);
}

// ══ ChatGPT ══════════════════════════════════════════════════════════════════
function scrapeChatGPT() {
  const results = [];

  // Strategy 1: Modern conversation-turn articles (2025/2026 standard)
  const turns = document.querySelectorAll("article[data-testid^='conversation-turn']");
  if (turns.length > 0) {
    turns.forEach(turn => {
      const testid = turn.getAttribute("data-testid") || "";
      const isUser = testid.includes("user") || turn.querySelector("[data-message-author-role='user']");
      const isAI = testid.includes("assistant") || turn.querySelector("[data-message-author-role='assistant']");

      const textEl = turn.querySelector("[data-message-author-role]") || turn.querySelector(".whitespace-pre-wrap") || turn;
      const text = extractCleanMessageText(textEl);

      if (text.length > 2) {
        results.push({
          sender: isUser ? "user" : "ai",
          text,
          element: turn
        });
      }
    });
    if (results.length > 0) return results;
  }

  // Strategy 2: [data-message-author-role]
  const authorEls = document.querySelectorAll("[data-message-author-role]");
  if (authorEls.length > 0) {
    authorEls.forEach(el => {
      const role = el.getAttribute("data-message-author-role");
      const text = extractCleanMessageText(el);
      if (text.length > 2) {
        results.push({
          sender: role === "user" ? "user" : "ai",
          text,
          element: el.closest("article") || el
        });
      }
    });
    if (results.length > 0) return results;
  }

  return results;
}

// ══ Claude ════════════════════════════════════════════════════════════════════
function scrapeClaude() {
  const results = [];

  // Strategy 1: data-testid human-turn / assistant-turn / user-message / assistant-message
  const turns = document.querySelectorAll(
    '[data-testid="human-turn"], [data-testid="assistant-turn"], [data-testid="user-message"], [data-testid="assistant-message"]'
  );
  if (turns.length > 0) {
    turns.forEach(t => {
      const testid = t.getAttribute("data-testid") || "";
      const isUser = testid.includes("human") || testid.includes("user");
      const text = extractCleanMessageText(t);
      if (text.length > 2) {
        results.push({
          sender: isUser ? "user" : "ai",
          text,
          element: t
        });
      }
    });
    if (results.length > 0) return results;
  }

  // Strategy 2: .font-user-message & .font-claude-message
  const fontEls = document.querySelectorAll(".font-user-message, .font-claude-message, [class*='font-user'], [class*='font-claude']");
  if (fontEls.length > 0) {
    fontEls.forEach(el => {
      const cls = (el.className || "").toLowerCase();
      const isUser = cls.includes("user");
      const text = extractCleanMessageText(el);
      if (text.length > 2) {
        results.push({
          sender: isUser ? "user" : "ai",
          text,
          element: el.closest("[data-testid]") || el
        });
      }
    });
    if (results.length > 0) return results;
  }

  // Strategy 3: Conversation container child rows
  const feed = document.querySelector('[data-testid="conversation-content"], .conversation-content, main [class*="conversation"]');
  if (feed) {
    const blocks = Array.from(feed.children).filter(c => c.clientHeight > 25);
    blocks.forEach((b, i) => {
      const text = extractCleanMessageText(b);
      if (text.length > 5) {
        const isUser = b.querySelector("[class*='human'], [class*='user']") !== null;
        results.push({
          sender: isUser ? "user" : (i % 2 === 0 ? "user" : "ai"),
          text,
          element: b
        });
      }
    });
  }

  return results;
}

// ══ Gemini ═══════════════════════════════════════════════════════════════════
function scrapeGemini() {
  const results = [];

  // Strategy 1: Web Components <user-query> & <model-response>
  const userQueries = Array.from(document.querySelectorAll("user-query, .user-query-container, [data-turn-role='user']"));
  const modelResponses = Array.from(document.querySelectorAll("model-response, .model-response-container, [data-turn-role='model']"));

  if (userQueries.length > 0 || modelResponses.length > 0) {
    const combined = [
      ...userQueries.map(el => ({ el, sender: "user" })),
      ...modelResponses.map(el => ({ el, sender: "ai" }))
    ].sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    combined.forEach(({ el, sender }) => {
      const text = extractCleanMessageText(el);
      if (text.length > 2) {
        results.push({
          sender,
          text,
          element: el
        });
      }
    });
    if (results.length > 0) return results;
  }

  // Strategy 2: conversation-turn or chat-turn
  const turns = document.querySelectorAll("[class*='conversation-turn'], [class*='chat-turn']");
  if (turns.length > 0) {
    turns.forEach(t => {
      const cls = (t.className || "").toLowerCase();
      const isUser = cls.includes("user") || t.querySelector("user-query") !== null;
      const text = extractCleanMessageText(t);
      if (text.length > 2) {
        results.push({
          sender: isUser ? "user" : "ai",
          text,
          element: t
        });
      }
    });
  }

  return results;
}

// ══ DeepSeek ═════════════════════════════════════════════════════════════════
function scrapeDeepSeek() {
  const results = [];

  // DeepSeek chat container structure
  const msgContainers = document.querySelectorAll(
    "[class*='chat-message'], [class*='ds-message'], div[class*='message-bubble'], div[class*='message-item']"
  );

  if (msgContainers.length > 0) {
    msgContainers.forEach(container => {
      const cls = (container.className || "").toLowerCase();
      const isUser = cls.includes("user") || cls.includes("right") || cls.includes("self") || container.querySelector("[class*='user']");
      const text = extractCleanMessageText(container);
      if (text.length > 2) {
        results.push({
          sender: isUser ? "user" : "ai",
          text,
          element: container
        });
      }
    });
    if (results.length > 0) return results;
  }

  // Fallback for DeepSeek: look for markdown blocks vs user prompt blocks
  const mdBlocks = document.querySelectorAll(".ds-markdown, [class*='markdown']");
  if (mdBlocks.length > 0) {
    mdBlocks.forEach(el => {
      const text = extractCleanMessageText(el);
      if (text.length > 5) {
        results.push({
          sender: "ai",
          text,
          element: el.closest("div[class*='message']") || el
        });
      }
    });
  }

  return results;
}

// ══ Perplexity ═══════════════════════════════════════════════════════════════
function scrapePerplexity() {
  const results = [];
  const queryBlocks = document.querySelectorAll("[data-testid='query-block'], [class*='query'], h1[class*='title']");
  const answerBlocks = document.querySelectorAll("[data-testid='answer-block'], [class*='answer'], .prose");

  const combined = [
    ...Array.from(queryBlocks).map(el => ({ el, sender: "user" })),
    ...Array.from(answerBlocks).map(el => ({ el, sender: "ai" }))
  ].sort((a, b) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );

  combined.forEach(({ el, sender }) => {
    const text = extractCleanMessageText(el);
    if (text.length > 2) {
      results.push({ sender, text, element: el });
    }
  });

  return results;
}

// ══ Mistral (Le Chat) ═══════════════════════════════════════════════════════
function scrapeMistral() {
  const results = [];
  const turns = document.querySelectorAll("[class*='chat-turn'], [data-role], div[class*='message']");
  turns.forEach(turn => {
    const role = turn.getAttribute("data-role") || "";
    const cls = (turn.className || "").toLowerCase();
    const isUser = role === "user" || cls.includes("user") || cls.includes("human");
    const isAI = role === "assistant" || cls.includes("assistant") || cls.includes("bot");
    const text = extractCleanMessageText(turn);
    if (text.length > 2 && (isUser || isAI)) {
      results.push({
        sender: isUser ? "user" : "ai",
        text,
        element: turn
      });
    }
  });
  return results;
}

// ══ Copilot / Grok / Poe / Universal ════════════════════════════════════════
function scrapeCopilot() {
  return scrapeByRoles(["[data-author='user']", "[data-author='bot']"]);
}

function scrapeGrok() {
  const results = [];
  const grokTurns = document.querySelectorAll("[data-testid*='grok'], div[class*='message']");
  grokTurns.forEach(turn => {
    const text = extractCleanMessageText(turn);
    if (text.length > 5) {
      const isUser = turn.querySelector("[class*='user'], [data-testid*='user']") !== null;
      results.push({ sender: isUser ? "user" : "ai", text, element: turn });
    }
  });
  return results;
}

function scrapePoe() {
  const results = [];
  const bubbles = document.querySelectorAll("[class*='Message_bubble'], [class*='messageBubble']");
  bubbles.forEach(b => {
    const text = extractCleanMessageText(b);
    if (text.length > 2) {
      const isUser = (b.className || "").includes("human") || (b.className || "").includes("User");
      results.push({ sender: isUser ? "user" : "ai", text, element: b });
    }
  });
  return results;
}

function scrapeByRoles(selectors) {
  const results = [];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const text = extractCleanMessageText(el);
      if (text.length > 2) {
        const isUser = sel.includes("user") || sel.includes("human");
        results.push({ sender: isUser ? "user" : "ai", text, element: el });
      }
    });
  });
  return results;
}

// ══ Universal Fallback ══════════════════════════════════════════════════════
function scrapeUniversal() {
  const results = [];
  const candidates = document.querySelectorAll("article, [role='listitem'], div[class*='message'], div[class*='turn']");

  candidates.forEach((el, i) => {
    if (el.clientHeight < 24) return;
    const text = extractCleanMessageText(el);
    if (text.length > 10) {
      const cls = (el.className || "").toLowerCase();
      const isUser = cls.includes("user") || cls.includes("human");
      results.push({
        sender: isUser ? "user" : (i % 2 === 0 ? "user" : "ai"),
        text,
        element: el
      });
    }
  });

  return results;
}

// ─── TEXT CLEANER ─────────────────────────────────────────────────────────────
function extractCleanMessageText(element) {
  if (!element) return "";

  // Clone element so we can remove unwanted buttons/toolbars safely
  const clone = element.cloneNode(true);

  // Remove common UI noise (copy button, share button, regenerate, SVGs, audio icons)
  const noiseSelectors = [
    "button",
    "svg",
    "[role='button']",
    "[aria-label*='Copy']",
    "[aria-label*='Like']",
    "[aria-label*='Dislike']",
    "[aria-label*='Share']",
    "[aria-label*='Regenerate']",
    ".copy-button",
    ".feedback-buttons",
    ".tooltip",
    "footer",
    "nav"
  ];

  clone.querySelectorAll(noiseSelectors.join(",")).forEach(node => {
    // Only remove if it's small/button-like
    if (node.clientHeight < 60 && node.clientWidth < 120) {
      node.remove();
    }
  });

  let raw = clone.innerText || clone.textContent || "";
  return cleanText(raw);
}

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{3,}/g, "  ")
    .trim();
}

function getRawPageText() {
  const root =
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.querySelector("[role='log']") ||
    document.body;

  let text = cleanText(root.innerText);
  if (text.length < 300 && root !== document.body) {
    text = cleanText(document.body.innerText);
  }

  if (text.length > 30000) {
    text = "...[earlier conversation trimmed]...\n\n" + text.slice(text.length - 30000);
  }
  return text;
}

// ─── DEDUP AND ORDER ──────────────────────────────────────────────────────────
function dedupAndOrder(messages) {
  if (!messages || messages.length === 0) return [];

  // Deduplicate by text similarity / elements
  const seenElements = new Set();
  const seenTexts = new Set();
  const out = [];

  for (const m of messages) {
    if (m.element && seenElements.has(m.element)) continue;
    if (m.element) seenElements.add(m.element);

    const textSignature = `${m.sender}:${m.text.slice(0, 100)}`;
    if (seenTexts.has(textSignature)) continue;
    seenTexts.add(textSignature);

    out.push(m);
  }

  // Ensure DOM chronological order
  return out.sort((a, b) => {
    if (a.element && b.element && a.element !== b.element) {
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    }
    return 0;
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
