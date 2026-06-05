// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `[ROLE] — You are a Senior Context Architect & Information Manager AI, specialized in synthesizing AI conversations into a precise, structured Context State Document that serves as a perfect memory baseline for future sessions.

[CONTEXT] — You will receive raw text scraped from an AI chat page (Claude / ChatGPT / Gemini). The text may contain UI navigation elements — ignore those and focus only on the conversation content.

[TASK] — Analyze the entire conversation transcript and extract the following five categories with extreme precision. Focus on high-signal, actionable information — not verbatim repetition:

1. CORE OBJECTIVES
   - The primary goal(s) and underlying intent the user established in this conversation.
   - What the user ultimately wants to achieve by the end of the session.

2. TECHNICAL CONSTRAINTS & RULES
   - All non-negotiable parameters, stylistic preferences, and operational guidelines set during the conversation.
   - Includes: tech stack choices, code style rules, language preferences, formatting rules, and any "do not do X" constraints.

3. MILESTONES & DECISIONS
   - Specific conclusions reached, tasks completed, solutions agreed upon, and explicit approvals given.
   - For code: summarize what was written and what it does (do NOT paste entire code blocks — summarize them).

4. USER PROFILE & CONTEXT
   - Background information, domain expertise level, recurring preferences, and unique themes about this user's working style.
   - Anything that shapes HOW the AI should respond (tone: formal/casual, depth: detailed/concise, etc.).

5. PENDING ACTIONS & NEXT STEPS
   - Unresolved items, open questions, and explicitly planned next steps.
   - What the AI was in the middle of doing when the session ended.

[FORMAT] — Output must be a structured Continuation Prompt document using this exact format:

=== CONTEXT CARRY — SESSION SNAPSHOT ===

**Platform:** [detected platform]
**Session Language:** [language used]
**AI Response Style:** [e.g., casual & technical / formal & concise]

---
### 🎯 CORE OBJECTIVES
[bullet points]

---
### ⚙️ TECHNICAL CONSTRAINTS & RULES
[bullet points]

---
### ✅ MILESTONES & DECISIONS
[bullet points]

---
### 👤 USER PROFILE & CONTEXT
[bullet points]

---
### 🔄 PENDING ACTIONS & NEXT STEPS
[bullet points]

---
### 📋 CONTINUATION INSTRUCTION
[Write 2–4 sentences in the same language as the conversation. This is the direct instruction to the new AI session: briefly recap what was happening and give an explicit command to continue — e.g., "We were building X. The last thing completed was Y. Continue by doing Z."]

=== END OF CONTEXT CARRY ===

[CONSTRAINTS]
- Use the same language as the original conversation for the Continuation Instruction section.
- The section headers and structure must remain in English for consistency.
- Only include high-signal, actionable information. No conversational filler.
- If a section has no relevant information, write "N/A" — do not omit the section.
- Max output: 600 words.
- Output ONLY the document above — no additional explanation before or after it.`;

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
async function handleGeneratePrompt(rawText, platform, maxMessages = 20) {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Not enough conversation content to process.");
  }

  // Trim to last ~maxMessages worth of content if too long
  // Approximate: 1 message ≈ 300 chars → maxMessages messages ≈ maxMessages * 300 chars
  const maxChars = maxMessages * 400;
  let contentToProcess = rawText;
  if (rawText.length > maxChars) {
    contentToProcess = "...[beginning of conversation trimmed]\n\n" + rawText.slice(rawText.length - maxChars);
  }

  const userContent = `[INPUT]
Platform: ${platform || "AI Chat"}

Below is the raw text scraped from the AI chat page. Analyze this conversation and generate a complete Context State Document following your instructions:

--- CONVERSATION START ---
${contentToProcess}
--- CONVERSATION END ---

Now extract all five categories (Core Objectives, Technical Constraints & Rules, Milestones & Decisions, User Profile & Context, Pending Actions & Next Steps) and produce the full structured document.`;

  // Resolve API keys — BYOK only, always read from local storage
  const storage = await chrome.storage.local.get(["geminiKey", "groqKey", "openrouterKey", "openrouterModel"]);
  const geminiKey = storage.geminiKey || "";
  const groqKey = storage.groqKey || "";
  const openrouterKey = storage.openrouterKey || "";
  const openrouterModel = storage.openrouterModel || "google/gemini-2.0-flash:free";

  const errors = [];

  // 1. Try Gemini (Primary)
  if (geminiKey && geminiKey.trim()) {
    try {
      console.log("The Context: Calling Gemini API...");
      const prompt = await callGemini(geminiKey.trim(), userContent);
      return { prompt, provider: "Gemini" };
    } catch (err) {
      console.warn("The Context: Gemini failed:", err.message);
      errors.push(`Gemini: ${err.message}`);
    }
  } else {
    errors.push("Gemini: API key not configured.");
  }

  // 2. Try Groq (Fallback)
  if (groqKey && groqKey.trim()) {
    try {
      console.log("The Context: Calling Groq API...");
      const prompt = await callGroq(groqKey.trim(), userContent);
      return { prompt, provider: "Groq" };
    } catch (err) {
      console.warn("The Context: Groq failed:", err.message);
      errors.push(`Groq: ${err.message}`);
    }
  } else {
    errors.push("Groq: API key not configured.");
  }

  // 3. Try OpenRouter (Fallback)
  if (openrouterKey && openrouterKey.trim()) {
    try {
      console.log("The Context: Calling OpenRouter API...");
      const prompt = await callOpenRouter(openrouterKey.trim(), openrouterModel, userContent);
      return { prompt, provider: "OpenRouter" };
    } catch (err) {
      console.warn("The Context: OpenRouter failed:", err.message);
      errors.push(`OpenRouter: ${err.message}`);
    }
  } else {
    errors.push("OpenRouter: API key not configured.");
  }

  throw new Error(
    `All providers failed:\n${errors.map(e => "• " + e).join("\n")}\n\n` +
    `Please add your API keys in the Settings tab.\n` +
    `Free Gemini API key: https://aistudio.google.com/app/apikey\n` +
    `Free Groq API key: https://console.groq.com/keys\n` +
    `OpenRouter API key: https://openrouter.ai/keys`
  );
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
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
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
      temperature: 0.3,
      max_tokens: 2048
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
      temperature: 0.3,
      max_tokens: 2048
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
