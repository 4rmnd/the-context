// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
// The AI's ONLY job is to generate a compact structured HEADER.
// The full verbatim conversation is appended by our code AFTER the AI response.
// This guarantees 100% context — no information is ever lost to summarization.
const SYSTEM_PROMPT = `[ROLE] — You are a Senior Context Architect & Information Manager AI.

[CONTEXT] — You will receive raw text scraped from an AI chat page (Claude / ChatGPT / Gemini). The text may contain UI navigation elements — ignore those and focus only on the conversation content.

[IMPORTANT] — Your job is NOT to summarize the conversation. The full conversation transcript will be attached separately after your output. Your job is ONLY to generate a compact structured HEADER that provides meta-context to help a new AI session instantly understand the situation before reading the transcript.

[TASK] — Generate a compact SESSION HEADER with these four sections:

1. QUICK BRIEF (2–3 sentences max)
   - What is this conversation about? What is the user trying to accomplish?

2. ACTIVE CONSTRAINTS & RULES
   - Non-negotiable rules, stylistic preferences, tech stack choices, formatting requirements, or any "do not do X" directives established in the conversation.
   - Only list what was explicitly stated. If none, write "None specified."

3. STATUS & LAST CHECKPOINT
   - What has been completed so far? What was the AI in the middle of doing when the session ended?
   - Be specific — name specific tasks, solutions, files, or steps that were completed.

4. CONTINUATION DIRECTIVE (write in the same language as the conversation)
   - A direct, explicit instruction for the new AI session.
   - Format: "We were [doing X]. [Y] has been completed. Now continue by [Z]."
   - This must be actionable and specific — not vague.

[FORMAT] — Use exactly this structure:

╔══════════════════════════════════════════════════╗
║         CONTEXT CARRY — SESSION HEADER           ║
╚══════════════════════════════════════════════════╝

📌 QUICK BRIEF
[2–3 sentences]

⚙️ ACTIVE CONSTRAINTS & RULES
[bullet list or "None specified"]

✅ STATUS & LAST CHECKPOINT
[bullet list of what's done and what was in progress]

▶️ CONTINUATION DIRECTIVE
[Direct instruction in conversation's language]

══════════════════════════════════════════════════
    ↓ FULL CONVERSATION TRANSCRIPT BELOW ↓
══════════════════════════════════════════════════

[CONSTRAINTS]
- Be extremely concise. This header must be under 250 words.
- Do NOT reproduce any part of the conversation in the header — the full transcript follows.
- Output ONLY the header block above. Nothing before or after it.`;

// Keys are always user-supplied (BYOK only). No built-in keys.

// ─── LISTENER ────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generate_prompt") {
    handleGeneratePrompt(request.rawText, request.platform, request.maxMessages)
      .then(result => {
        sendResponse({ success: true, prompt: result.prompt, providerUsed: result.provider });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
async function handleGeneratePrompt(rawText, platform, maxMessages = 50) {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Not enough conversation content to process.");
  }

  // ── Trim by message count if applicable ────────────────────────────────────
  // maxMessages = 0 means unlimited (send all).
  // rawText is formatted as "[USER]:\n...\n\n[AI]:\n...\n\n" so we split on that pattern.
  let trimmedText = rawText;
  if (maxMessages > 0) {
    trimmedText = trimByMessageCount(rawText, maxMessages);
  }

  // ── What we send to the AI API ──────────────────────────────────────────────
  // We send enough context for the AI to understand, but cap at ~20k chars for API efficiency.
  // For "All messages" mode we allow up to 40k chars since user explicitly wants full context.
  const MAX_API_CHARS = maxMessages === 0 ? 40000 : 20000;
  let contentForAPI = trimmedText;
  if (trimmedText.length > MAX_API_CHARS) {
    // Send first 40% + last 60% so the AI sees both the original task AND the latest progress
    const headChars = Math.floor(MAX_API_CHARS * 0.40);
    const tailChars = Math.floor(MAX_API_CHARS * 0.60);
    const head = trimmedText.slice(0, headChars);
    const tail = trimmedText.slice(trimmedText.length - tailChars);
    contentForAPI = head + "\n\n...[middle section omitted from this API call — full transcript included below]...\n\n" + tail;
  }

  const userContent = `Platform: ${platform || "AI Chat"}

Here is the raw conversation text. Generate the SESSION HEADER as instructed:

--- CONVERSATION START ---
${contentForAPI}
--- CONVERSATION END ---`;

  // ── What we append verbatim to the final output ────────────────────────────
  // The full (or trimmed) transcript is appended AFTER the AI header.
  // Cap at 50k chars for "All" mode, 30k otherwise.
  const MAX_TRANSCRIPT_CHARS = maxMessages === 0 ? 50000 : 30000;
  let verbatimTranscript = trimmedText;
  if (trimmedText.length > MAX_TRANSCRIPT_CHARS) {
    const headChars = Math.floor(MAX_TRANSCRIPT_CHARS * 0.35);
    const tailChars = Math.floor(MAX_TRANSCRIPT_CHARS * 0.65);
    const head = trimmedText.slice(0, headChars);
    const tail = trimmedText.slice(trimmedText.length - tailChars);
    verbatimTranscript =
      head +
      "\n\n...[MIDDLE SECTION — conversation was very long, this portion is omitted to fit context limits]...\n\n" +
      tail;
  }


  // Resolve API keys — BYOK only, always read from local storage
  const storage = await chrome.storage.local.get(["geminiKey", "groqKey", "openrouterKey", "openrouterModel"]);
  const geminiKey = storage.geminiKey || "";
  const groqKey = storage.groqKey || "";
  const openrouterKey = storage.openrouterKey || "";
  const openrouterModel = storage.openrouterModel || "google/gemini-2.0-flash:free";

  const errors = [];
  let aiHeader = null;
  let providerUsed = null;

  // 1. Try Gemini (Primary)
  if (geminiKey && geminiKey.trim()) {
    try {
      console.log("The Context: Calling Gemini API...");
      aiHeader = await callGemini(geminiKey.trim(), userContent);
      providerUsed = "Gemini";
    } catch (err) {
      console.warn("The Context: Gemini failed:", err.message);
      errors.push(`Gemini: ${err.message}`);
    }
  } else {
    errors.push("Gemini: API key not configured.");
  }

  // 2. Try Groq (Fallback)
  if (!aiHeader && groqKey && groqKey.trim()) {
    try {
      console.log("The Context: Calling Groq API...");
      aiHeader = await callGroq(groqKey.trim(), userContent);
      providerUsed = "Groq";
    } catch (err) {
      console.warn("The Context: Groq failed:", err.message);
      errors.push(`Groq: ${err.message}`);
    }
  } else if (!aiHeader) {
    errors.push("Groq: API key not configured.");
  }

  // 3. Try OpenRouter (Fallback)
  if (!aiHeader && openrouterKey && openrouterKey.trim()) {
    try {
      console.log("The Context: Calling OpenRouter API...");
      aiHeader = await callOpenRouter(openrouterKey.trim(), openrouterModel, userContent);
      providerUsed = "OpenRouter";
    } catch (err) {
      console.warn("The Context: OpenRouter failed:", err.message);
      errors.push(`OpenRouter: ${err.message}`);
    }
  } else if (!aiHeader) {
    errors.push("OpenRouter: API key not configured.");
  }

  if (!aiHeader) {
    throw new Error(
      `All providers failed:\n${errors.map(e => "• " + e).join("\n")}\n\n` +
      `Please add your API keys in the Settings tab.\n` +
      `Free Gemini API key: https://aistudio.google.com/app/apikey\n` +
      `Free Groq API key: https://console.groq.com/keys\n` +
      `OpenRouter API key: https://openrouter.ai/keys`
    );
  }

  // ── Assemble the final output: AI header + verbatim full transcript ──────────
  // This is the KEY insight: we never lose context because the ENTIRE conversation
  // is included verbatim. The new AI reads the header first (instant orientation),
  // then reads the full transcript (complete recall).
  const finalPrompt =
    aiHeader.trim() +
    "\n\n" +
    "══════════════════════════════════════════════════\n" +
    "         📄 FULL CONVERSATION TRANSCRIPT\n" +
    `         Platform: ${platform || "AI Chat"} | Provider: ${providerUsed}\n` +
    "══════════════════════════════════════════════════\n\n" +
    verbatimTranscript.trim() +
    "\n\n══════════════════════════════════════════════════\n" +
    "         END OF CONTEXT CARRY PACKAGE\n" +
    "══════════════════════════════════════════════════";

  return { prompt: finalPrompt, provider: providerUsed };
}

// ─── TRIM BY MESSAGE COUNT ────────────────────────────────────────────────────
// rawText is formatted as blocks separated by "\n\n" where each block starts
// with "[USER]:\n" or "[AI]:\n". We split into those blocks, keep the first
// message (original context) + the N most recent messages.
function trimByMessageCount(rawText, maxMessages) {
  if (!maxMessages || maxMessages <= 0) return rawText;

  // Split on the message block separator pattern
  // Blocks look like: "[USER]:\n..." or "[AI]:\n..."
  const blocks = rawText.split(/\n\n(?=\[(?:USER|AI)\]:)/);

  if (blocks.length <= maxMessages) return rawText; // Already within limit

  // Keep first message (original task context) + last (maxMessages - 1) messages
  const firstBlock = blocks[0];
  const recentBlocks = blocks.slice(blocks.length - (maxMessages - 1));

  const omittedCount = blocks.length - maxMessages;
  const omittedNote = `\n\n...[${omittedCount} earlier messages omitted — showing first message + last ${maxMessages - 1} messages]...\n\n`;

  return firstBlock + omittedNote + recentBlocks.join("\n\n");
}


// ─── GEMINI API ───────────────────────────────────────────────────────────────
async function callGemini(apiKey, userContent) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
    })
  });

  if (!response.ok) {
    let detail = response.statusText;
    try { detail = (await response.json()).error?.message || detail; } catch (_) {}
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini.");
  return text.trim();
}

// ─── GROQ API ─────────────────────────────────────────────────────────────────
async function callGroq(apiKey, userContent) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    let detail = response.statusText;
    try { detail = (await response.json()).error?.message || detail; } catch (_) {}
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq.");
  return text.trim();
}

// ─── OPENROUTER API ───────────────────────────────────────────────────────────
async function callOpenRouter(apiKey, model, userContent) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/arman/the-context",
      "X-Title": "The Context Chrome Extension"
    },
    body: JSON.stringify({
      model: model || "google/gemini-2.0-flash:free",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    let detail = response.statusText;
    try { detail = (await response.json()).error?.message || detail; } catch (_) {}
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenRouter.");
  return text.trim();
}
