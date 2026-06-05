// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an assistant tasked with creating a "Continuation Prompt" from an AI conversation.

You will receive RAW TEXT from an AI chat web page (Claude / ChatGPT / Gemini). This is all the visible text on the page, which may include some UI navigation text around the edges.

Your task:
1. Identify and separate USER messages vs AI messages from the raw text (ignore UI/navigation text)
2. Understand: the main topic, the user's goal, the AI's last output, and what remains unfinished
3. Write a single block of text that can be pasted directly into a new AI session so the conversation can continue without losing context

Output format:
- Concise but complete (max 500 words)
- Use the same language as the original conversation
- Include explicit instructions: "Continue from..." or "Finish..."
- Do not add any explanation — the output should ONLY be the Continuation Prompt itself

Do not lose:
- Decisions / results already agreed upon
- Code already written (summarize with a note of what exists)
- The tone and style of the discussion`;

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

  const userContent = `Platform: ${platform || "AI Chat"}

Here is the RAW TEXT from the AI chat page. Please create a Continuation Prompt:

---
${contentToProcess}
---`;

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
