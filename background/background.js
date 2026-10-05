// ─── THE CONTEXT — BACKGROUND SERVICE WORKER ────────────────────────────────
// Multi-Provider AI Engine with Round-Robin Rotation, Live Model Verification & Auto-Failover

const SYSTEM_PROMPT = `[ROLE] — You are a Senior Context Architect & Information Manager AI.

[CONTEXT] — You will receive raw text scraped from an AI chat page (Claude, ChatGPT, Gemini, DeepSeek, Perplexity, etc.). The text may contain UI navigation elements — ignore those and focus only on the conversation content.

[IMPORTANT] — Your job is NOT to summarize the conversation into a lossy paragraph. The full verbatim transcript will be attached after your output. Your job is ONLY to generate a compact structured HEADER that provides meta-context to help a new AI session instantly orient itself before reading the transcript.

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

// ─── MESSAGE LISTENER ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generate_prompt") {
    handleGeneratePrompt(request.rawText, request.platform, request.maxMessages)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open
  }

  if (request.action === "fetch_models") {
    fetchModelsForProvider(request.provider, request.apiKey, request.endpoint)
      .then(models => sendResponse({ success: true, models }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "verify_model") {
    verifyModelAccess(request.provider, request.model, request.apiKey, request.endpoint)
      .then(res => sendResponse({ success: true, ...res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ─── MAIN GENERATE HANDLER WITH ROUND-ROBIN & FAILOVER ────────────────────────
async function handleGeneratePrompt(rawText, platform, maxMessages = 50) {
  if (!rawText || rawText.trim().length < 30) {
    throw new Error("Not enough conversation content detected to process.");
  }

  // 1. Trim by message count if requested
  let trimmedText = rawText;
  if (maxMessages > 0) {
    trimmedText = trimByMessageCount(rawText, maxMessages);
  }

  // 2. Prepare content for AI API call
  const MAX_API_CHARS = maxMessages === 0 ? 40000 : 25000;
  let contentForAPI = trimmedText;
  if (trimmedText.length > MAX_API_CHARS) {
    const headChars = Math.floor(MAX_API_CHARS * 0.40);
    const tailChars = Math.floor(MAX_API_CHARS * 0.60);
    const head = trimmedText.slice(0, headChars);
    const tail = trimmedText.slice(trimmedText.length - tailChars);
    contentForAPI = head + "\n\n...[middle section omitted from API call — full transcript attached below]...\n\n" + tail;
  }

  const userContent = `Platform: ${platform || "AI Chat"}

Here is the conversation text. Generate the SESSION HEADER as instructed:

--- CONVERSATION START ---
${contentForAPI}
--- CONVERSATION END ---`;

  // 3. Prepare full transcript for final output
  const MAX_TRANSCRIPT_CHARS = maxMessages === 0 ? 60000 : 35000;
  let verbatimTranscript = trimmedText;
  if (trimmedText.length > MAX_TRANSCRIPT_CHARS) {
    const headChars = Math.floor(MAX_TRANSCRIPT_CHARS * 0.35);
    const tailChars = Math.floor(MAX_TRANSCRIPT_CHARS * 0.65);
    verbatimTranscript =
      trimmedText.slice(0, headChars) +
      "\n\n...[MIDDLE SECTION OMITTED TO FIT CONTEXT LIMITS]...\n\n" +
      trimmedText.slice(trimmedText.length - tailChars);
  }

  // 4. Retrieve settings & keys from storage
  const storage = await chrome.storage.local.get([
    "routingMode",        // 'cascade' or 'round-robin'
    "roundRobinIndex",
    "geminiKey", "geminiModel",
    "groqKey", "groqModel",
    "deepseekKey", "deepseekModel",
    "openrouterKey", "openrouterModel",
    "openaiKey", "openaiModel",
    "nvidiaKey", "nvidiaModel",
    "ollamaEndpoint", "ollamaKey", "ollamaModel",
    "mistralKey", "mistralModel",
    "cerebrasKey", "cerebrasModel",
    "sambanovaKey", "sambanovaModel"
  ]);

  const routingMode = storage.routingMode || "cascade";
  let rrIndex = storage.roundRobinIndex || 0;

  // Build list of active candidates (configured providers)
  const candidatePool = [];

  if (storage.geminiKey?.trim()) {
    candidatePool.push({
      provider: "Gemini",
      model: storage.geminiModel || "gemini-2.0-flash",
      apiKey: storage.geminiKey.trim(),
      execute: (k, m, c) => callGemini(k, m, c)
    });
  }

  if (storage.groqKey?.trim()) {
    candidatePool.push({
      provider: "Groq",
      model: storage.groqModel || "llama-3.3-70b-versatile",
      apiKey: storage.groqKey.trim(),
      execute: (k, m, c) => callGroq(k, m, c)
    });
  }

  if (storage.deepseekKey?.trim()) {
    candidatePool.push({
      provider: "DeepSeek",
      model: storage.deepseekModel || "deepseek-chat",
      apiKey: storage.deepseekKey.trim(),
      execute: (k, m, c) => callDeepSeek(k, m, c)
    });
  }

  if (storage.openrouterKey?.trim()) {
    candidatePool.push({
      provider: "OpenRouter",
      model: storage.openrouterModel || "google/gemini-2.0-flash:free",
      apiKey: storage.openrouterKey.trim(),
      execute: (k, m, c) => callOpenRouter(k, m, c)
    });
  }

  if (storage.openaiKey?.trim()) {
    candidatePool.push({
      provider: "OpenAI",
      model: storage.openaiModel || "gpt-4o-mini",
      apiKey: storage.openaiKey.trim(),
      execute: (k, m, c) => callOpenAI(k, m, c)
    });
  }

  if (storage.nvidiaKey?.trim()) {
    candidatePool.push({
      provider: "NVIDIA NIM",
      model: storage.nvidiaModel || "meta/llama-3.3-70b-instruct",
      apiKey: storage.nvidiaKey.trim(),
      execute: (k, m, c) => callNvidia(k, m, c)
    });
  }

  if (storage.ollamaEndpoint?.trim() || storage.ollamaModel?.trim()) {
    const oEndpoint = storage.ollamaEndpoint || "http://localhost:11434/v1";
    candidatePool.push({
      provider: "Ollama",
      model: storage.ollamaModel || "llama3.3:latest",
      apiKey: (storage.ollamaKey || "").trim(),
      endpoint: oEndpoint,
      execute: (k, m, c) => callOllama(oEndpoint, k, m, c)
    });
  }

  if (storage.mistralKey?.trim()) {
    candidatePool.push({
      provider: "Mistral",
      model: storage.mistralModel || "mistral-large-latest",
      apiKey: storage.mistralKey.trim(),
      execute: (k, m, c) => callMistral(k, m, c)
    });
  }

  if (storage.cerebrasKey?.trim()) {
    candidatePool.push({
      provider: "Cerebras",
      model: storage.cerebrasModel || "llama-3.3-70b",
      apiKey: storage.cerebrasKey.trim(),
      execute: (k, m, c) => callCerebras(k, m, c)
    });
  }

  if (storage.sambanovaKey?.trim()) {
    candidatePool.push({
      provider: "SambaNova",
      model: storage.sambanovaModel || "Meta-Llama-3.3-70B-Instruct",
      apiKey: storage.sambanovaKey.trim(),
      execute: (k, m, c) => callSambaNova(k, m, c)
    });
  }

  if (candidatePool.length === 0) {
    throw new Error(
      "No AI provider keys configured.\n\nPlease open the Settings tab and add an API key for one of the supported AI providers (Gemini, Groq, DeepSeek, OpenRouter, OpenAI, NVIDIA, Ollama, Mistral, Cerebras, or SambaNova)."
    );
  }

  // 5. Execute request with Round-Robin, Fusion, or Cascade Failover
  let executionList = [...candidatePool];

  if (routingMode === "round-robin") {
    // Start from round-robin index, wrapping around
    const startIdx = rrIndex % candidatePool.length;
    executionList = [
      ...candidatePool.slice(startIdx),
      ...candidatePool.slice(0, startIdx)
    ];
  }

  let aiHeader = null;
  let providerUsed = null;
  let modelUsed = null;
  const errors = [];

  // Fusion mode: parallel race top candidates for ultra-fast consensus response
  if (routingMode === "fusion" && candidatePool.length >= 2) {
    const panel = candidatePool.slice(0, 3);
    console.log(`The Context: Running Fusion Panel across ${panel.map(p => p.provider).join(", ")}...`);
    try {
      const winner = await Promise.any(
        panel.map(c =>
          c.execute(c.apiKey, c.model, userContent)
            .then(res => ({ text: res, candidate: c }))
        )
      );
      aiHeader = winner.text;
      providerUsed = `${winner.candidate.provider} (Fusion)`;
      modelUsed = winner.candidate.model;
    } catch (aggErr) {
      console.warn("The Context: Fusion panel failed, falling back to cascade", aggErr);
    }
  }

  for (const candidate of executionList) {
    try {
      console.log(`The Context: Calling ${candidate.provider} (${candidate.model})...`);
      aiHeader = await candidate.execute(candidate.apiKey, candidate.model, userContent);
      providerUsed = candidate.provider;
      modelUsed = candidate.model;
      break; // Success!
    } catch (err) {
      console.warn(`The Context: ${candidate.provider} (${candidate.model}) failed:`, err.message);
      errors.push(`${candidate.provider} [${candidate.model}]: ${err.message}`);
    }
  }

  if (!aiHeader) {
    throw new Error(
      `All available providers failed:\n${errors.map(e => "• " + e).join("\n")}\n\n` +
      `Check your API keys and quota in the Settings tab.`
    );
  }

  // Increment round-robin index for next run
  if (routingMode === "round-robin") {
    const nextIdx = (rrIndex + 1) % candidatePool.length;
    await chrome.storage.local.set({ roundRobinIndex: nextIdx });
  }

  // 6. Assemble the final Continuation Prompt
  const finalPrompt =
    aiHeader.trim() +
    "\n\n" +
    "══════════════════════════════════════════════════\n" +
    "         📄 FULL CONVERSATION TRANSCRIPT\n" +
    `         Platform: ${platform || "AI Chat"} | Engine: ${providerUsed} (${modelUsed})\n` +
    "══════════════════════════════════════════════════\n\n" +
    verbatimTranscript.trim() +
    "\n\n══════════════════════════════════════════════════\n" +
    "         END OF CONTEXT CARRY PACKAGE\n" +
    "══════════════════════════════════════════════════";

  return {
    prompt: finalPrompt,
    providerUsed,
    modelUsed,
    routingMode,
    candidateCount: candidatePool.length
  };
}

// ─── TRIM BY MESSAGE COUNT ────────────────────────────────────────────────────
function trimByMessageCount(rawText, maxMessages) {
  if (!maxMessages || maxMessages <= 0) return rawText;

  const blocks = rawText.split(/\n\n(?=\[(?:USER|AI)\]:)/);
  if (blocks.length <= maxMessages) return rawText;

  const firstBlock = blocks[0];
  const recentBlocks = blocks.slice(blocks.length - (maxMessages - 1));
  const omittedCount = blocks.length - maxMessages;

  const omittedNote = `\n\n...[${omittedCount} earlier messages omitted — showing initial prompt + last ${maxMessages - 1} messages]...\n\n`;
  return firstBlock + omittedNote + recentBlocks.join("\n\n");
}

// ─── PROVIDER API IMPLEMENTATIONS ─────────────────────────────────────────────

// 1. Google Gemini
async function callGemini(apiKey, model, userContent) {
  const modelName = model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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

// 2. Groq
async function callGroq(apiKey, model, userContent) {
  const modelName = model || "llama-3.3-70b-versatile";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
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

// 3. DeepSeek
async function callDeepSeek(apiKey, model, userContent) {
  const modelName = model || "deepseek-chat";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
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
  if (!text) throw new Error("Empty response from DeepSeek.");
  return text.trim();
}

// 4. OpenRouter
async function callOpenRouter(apiKey, model, userContent) {
  const modelName = model || "google/gemini-2.0-flash:free";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/4rmnd/the-context",
      "X-Title": "The Context Chrome Extension"
    },
    body: JSON.stringify({
      model: modelName,
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

// 5. OpenAI
async function callOpenAI(apiKey, model, userContent) {
  const modelName = model || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
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
  if (!text) throw new Error("Empty response from OpenAI.");
  return text.trim();
}

// 6. NVIDIA NIM
async function callNvidia(apiKey, model, userContent) {
  const modelName = model || "meta/llama-3.3-70b-instruct";
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
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
    try { detail = (await response.json()).detail || (await response.json()).error?.message || detail; } catch (_) {}
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from NVIDIA NIM.");
  return text.trim();
}

// 7. Ollama (Cloud & Local)
async function callOllama(endpoint, apiKey, model, userContent) {
  let base = (endpoint || "http://localhost:11434/v1").replace(/\/+$/, "");
  if (!base.endsWith("/v1") && !base.includes("/api")) {
    base = `${base}/v1`;
  }
  const url = `${base}/chat/completions`;

  const headers = { "Content-Type": "application/json" };
  if (apiKey && apiKey.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model || "llama3.3:latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent }
      ],
      temperature: 0.2,
      stream: false
    })
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errObj = await response.json();
      detail = errObj.error?.message || errObj.error || detail;
    } catch (_) {}
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || data?.message?.content;
  if (!text) throw new Error("Empty response from Ollama.");
  return text.trim();
}

// 8. Mistral AI
async function callMistral(apiKey, model, userContent) {
  const modelName = model || "mistral-large-latest";
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
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
    try { detail = (await response.json()).message || (await response.json()).error?.message || detail; } catch (_) {}
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Mistral AI.");
  return text.trim();
}

// 9. Cerebras
async function callCerebras(apiKey, model, userContent) {
  const modelName = model || "llama-3.3-70b";
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
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
  if (!text) throw new Error("Empty response from Cerebras.");
  return text.trim();
}

// 10. SambaNova
async function callSambaNova(apiKey, model, userContent) {
  const modelName = model || "Meta-Llama-3.3-70B-Instruct";
  const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
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
  if (!text) throw new Error("Empty response from SambaNova.");
  return text.trim();
}

// ─── LIVE MODEL FETCHING & VERIFICATION ────────────────────────────────────────

async function fetchModelsForProvider(provider, apiKey, endpoint) {
  const prov = (provider || "").toLowerCase().trim();
  const key = (apiKey || "").replace(/[\r\n\t\s'"]/g, "").trim();

  if (!key && prov !== "openrouter" && prov !== "ollama") {
    throw new Error(`Please enter an API key for ${provider} first.`);
  }

  switch (prov) {
    case "gemini": {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData.error?.message || errData.message || "";
        } catch (_) {}

        // If listModels is restricted (403/404) or blocked, test generateContent ping
        if (res.status === 403 || res.status === 404) {
          try {
            await callGemini(key, "gemini-2.0-flash", "Test ping");
            return ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
          } catch (pingErr) {
            throw new Error(`Gemini (${res.status}): ${detail || pingErr.message || "Request failed"}`);
          }
        }

        throw new Error(`Gemini (${res.status}): ${detail || res.statusText || "Request failed"}`);
      }
      const data = await res.json();
      const models = (data.models || [])
        .filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
        .map(m => (m.name || "").replace(/^models\//, ""))
        .filter(id => id.startsWith("gemini-") || id.includes("flash") || id.includes("pro"));

      models.sort((a, b) => {
        if (a.includes("2.5") && !b.includes("2.5")) return -1;
        if (!a.includes("2.5") && b.includes("2.5")) return 1;
        if (a.includes("2.0") && !b.includes("2.0")) return -1;
        if (!a.includes("2.0") && b.includes("2.0")) return 1;
        return a.localeCompare(b);
      });

      return models.length > 0 ? models : ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    }

    case "groq": {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
      });
      if (!res.ok) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData.error?.message || errData.message || "";
        } catch (_) {}

        if (res.status === 403 || res.status === 404) {
          try {
            await callGroq(key, "llama-3.3-70b-versatile", "Test ping");
            return ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"];
          } catch (pingErr) {
            throw new Error(`Groq (${res.status}): ${detail || pingErr.message || "Request failed"}`);
          }
        }

        throw new Error(`Groq (${res.status}): ${detail || res.statusText || "Request failed"}`);
      }
      const data = await res.json();
      const models = (data.data || [])
        .map(m => m.id)
        .filter(id => !id.includes("whisper") && !id.includes("audio") && !id.includes("embed") && !id.includes("guard") && !id.includes("tts"))
        .sort();
      return models.length > 0 ? models : ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"];
    }

    case "openrouter": {
      const headers = { "Accept": "application/json" };
      if (key) headers["Authorization"] = `Bearer ${key}`;
      const res = await fetch("https://openrouter.ai/api/v1/models", { headers });
      if (!res.ok) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData.error?.message || errData.message || "";
        } catch (_) {}
        throw new Error(`OpenRouter (${res.status}): ${detail || res.statusText || "Request failed"}`);
      }
      const data = await res.json();
      const allIds = (data.data || []).map(m => m.id);
      const prioritized = [
        "google/gemini-2.0-flash:free",
        "deepseek/deepseek-r1:free",
        "deepseek/deepseek-chat",
        "meta-llama/llama-3.3-70b-instruct:free",
        "anthropic/claude-3.5-sonnet",
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "mistralai/mistral-large"
      ];
      const list = [
        ...prioritized.filter(p => allIds.includes(p)),
        ...allIds.filter(id => !prioritized.includes(id))
      ].slice(0, 100);
      return list.length > 0 ? list : prioritized;
    }

    case "deepseek": {
      const res = await fetch("https://api.deepseek.com/models", {
        headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
      });
      if (!res.ok) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData.error?.message || errData.message || "";
        } catch (_) {}

        if (res.status === 403 || res.status === 404) {
          try {
            await callDeepSeek(key, "deepseek-chat", "Test ping");
            return ["deepseek-chat", "deepseek-reasoner"];
          } catch (pingErr) {
            throw new Error(`DeepSeek (${res.status}): ${detail || pingErr.message || "Request failed"}`);
          }
        }

        throw new Error(`DeepSeek (${res.status}): ${detail || res.statusText || "Request failed"}`);
      }
      const data = await res.json();
      const models = (data.data || []).map(m => m.id);
      return models.length > 0 ? models : ["deepseek-chat", "deepseek-reasoner"];
    }

    case "openai": {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
      });
      if (!res.ok) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData.error?.message || errData.message || "";
        } catch (_) {}

        if (res.status === 403 || res.status === 404) {
          try {
            await callOpenAI(key, "gpt-4o-mini", "Test ping");
            return ["gpt-4o-mini", "gpt-4o", "o3-mini", "gpt-4-turbo"];
          } catch (pingErr) {
            throw new Error(`OpenAI (${res.status}): ${detail || pingErr.message || "Request failed"}`);
          }
        }

        throw new Error(`OpenAI (${res.status}): ${detail || res.statusText || "Request failed"}`);
      }
      const data = await res.json();
      const models = (data.data || [])
        .map(m => m.id)
        .filter(id => (id.includes("gpt") || id.includes("o1") || id.includes("o3")) && !id.includes("audio") && !id.includes("realtime") && !id.includes("transcription") && !id.includes("embedding") && !id.includes("tts"))
        .sort();
      return models.length > 0 ? models : ["gpt-4o-mini", "gpt-4o", "o3-mini", "gpt-4-turbo"];
    }

      case "nvidia": {
        const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
          headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
        });
        if (!res.ok) {
          let detail = "";
          try {
            const errData = await res.json();
            detail = errData.detail || errData.error?.message || errData.message || "";
          } catch (_) {}

          if (res.status === 403 || res.status === 404) {
            try {
              await callNvidia(key, "meta/llama-3.3-70b-instruct", "Test ping");
              return ["meta/llama-3.3-70b-instruct", "deepseek-ai/deepseek-r1", "mistralai/mistral-large-2-instruct", "nvidia/llama-3.1-nemotron-70b-instruct", "meta/llama-3.1-8b-instruct"];
            } catch (pingErr) {
              throw new Error(`NVIDIA NIM (${res.status}): ${detail || pingErr.message || "Request failed"}`);
            }
          }

          throw new Error(`NVIDIA NIM (${res.status}): ${detail || res.statusText || "Request failed"}`);
        }
        const data = await res.json();
        const models = (data.data || [])
          .map(m => m.id)
          .filter(id => !id.includes("embed") && !id.includes("rerank") && !id.includes("clip") && !id.includes("vision"))
          .sort();
        return models.length > 0 ? models : ["meta/llama-3.3-70b-instruct", "deepseek-ai/deepseek-r1", "mistralai/mistral-large-2-instruct", "nvidia/llama-3.1-nemotron-70b-instruct", "meta/llama-3.1-8b-instruct"];
      }

      case "ollama": {
        let base = (endpoint || "http://localhost:11434").replace(/\/+$/, "");
        if (base.endsWith("/v1")) base = base.replace(/\/v1$/, "");

        const headers = { "Accept": "application/json" };
        if (key) headers["Authorization"] = `Bearer ${key}`;

        // Try /api/tags first (standard Ollama endpoint)
        try {
          const res = await fetch(`${base}/api/tags`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.models) && data.models.length > 0) {
              return data.models.map(m => m.name || m.model).filter(Boolean);
            }
          }
        } catch (_) {}

        // Fallback to /v1/models (OpenAI compatibility mode)
        try {
          const res = await fetch(`${base}/v1/models`, { headers });
          if (res.ok) {
            const data = await res.json();
            const models = (data.data || []).map(m => m.id).filter(Boolean);
            if (models.length > 0) return models;
          }
        } catch (_) {}

        return ["llama3.3:latest", "llama3.1:latest", "deepseek-r1:latest", "qwen2.5-coder:latest", "mistral:latest"];
      }

      case "mistral": {
        const res = await fetch("https://api.mistral.ai/v1/models", {
          headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
        });
        if (!res.ok) {
          let detail = "";
          try {
            const errData = await res.json();
            detail = errData.message || errData.error?.message || "";
          } catch (_) {}

          if (res.status === 403 || res.status === 404) {
            try {
              await callMistral(key, "mistral-large-latest", "Test ping");
              return ["mistral-large-latest", "codestral-latest", "mistral-small-latest", "open-mistral-nemo"];
            } catch (pingErr) {
              throw new Error(`Mistral (${res.status}): ${detail || pingErr.message || "Request failed"}`);
            }
          }

          throw new Error(`Mistral (${res.status}): ${detail || res.statusText || "Request failed"}`);
        }
        const data = await res.json();
        const models = (data.data || [])
          .map(m => m.id)
          .filter(id => !id.includes("embed") && !id.includes("moderation"))
          .sort();
        return models.length > 0 ? models : ["mistral-large-latest", "codestral-latest", "mistral-small-latest", "open-mistral-nemo"];
      }

      case "cerebras": {
        const res = await fetch("https://api.cerebras.ai/v1/models", {
          headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
        });
        if (!res.ok) {
          let detail = "";
          try {
            const errData = await res.json();
            detail = errData.error?.message || errData.message || "";
          } catch (_) {}

          if (res.status === 403 || res.status === 404) {
            try {
              await callCerebras(key, "llama-3.3-70b", "Test ping");
              return ["llama-3.3-70b", "llama3.1-70b", "llama3.1-8b"];
            } catch (pingErr) {
              throw new Error(`Cerebras (${res.status}): ${detail || pingErr.message || "Request failed"}`);
            }
          }

          throw new Error(`Cerebras (${res.status}): ${detail || res.statusText || "Request failed"}`);
        }
        const data = await res.json();
        const models = (data.data || []).map(m => m.id).sort();
        return models.length > 0 ? models : ["llama-3.3-70b", "llama3.1-70b", "llama3.1-8b"];
      }

      case "sambanova": {
        const res = await fetch("https://api.sambanova.ai/v1/models", {
          headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
        });
        if (!res.ok) {
          let detail = "";
          try {
            const errData = await res.json();
            detail = errData.error?.message || errData.message || "";
          } catch (_) {}

          if (res.status === 403 || res.status === 404) {
            try {
              await callSambaNova(key, "Meta-Llama-3.3-70B-Instruct", "Test ping");
              return ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1-Distill-Llama-70B", "Qwen2.5-72B-Instruct", "Meta-Llama-3.1-8B-Instruct"];
            } catch (pingErr) {
              throw new Error(`SambaNova (${res.status}): ${detail || pingErr.message || "Request failed"}`);
            }
          }

          throw new Error(`SambaNova (${res.status}): ${detail || res.statusText || "Request failed"}`);
        }
        const data = await res.json();
        const models = (data.data || []).map(m => m.id).sort();
        return models.length > 0 ? models : ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1-Distill-Llama-70B", "Qwen2.5-72B-Instruct", "Meta-Llama-3.1-8B-Instruct"];
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async function verifyModelAccess(provider, model, apiKey, endpoint) {
    if (provider !== "ollama" && (!apiKey || !apiKey.trim())) {
      throw new Error("API key is required.");
    }
    if (!model || !model.trim()) throw new Error("Model identifier is required.");

    const testPrompt = "Test. Reply with only one word: 'OK'.";
    const key = (apiKey || "").trim();
    const mod = model.trim();

    let reply = "";
    switch (provider) {
      case "gemini":
        reply = await callGemini(key, mod, testPrompt);
        break;
      case "groq":
        reply = await callGroq(key, mod, testPrompt);
        break;
      case "deepseek":
        reply = await callDeepSeek(key, mod, testPrompt);
        break;
      case "openrouter":
        reply = await callOpenRouter(key, mod, testPrompt);
        break;
      case "openai":
        reply = await callOpenAI(key, mod, testPrompt);
        break;
      case "nvidia":
        reply = await callNvidia(key, mod, testPrompt);
        break;
      case "ollama":
        reply = await callOllama(endpoint || "http://localhost:11434/v1", key, mod, testPrompt);
        break;
      case "mistral":
        reply = await callMistral(key, mod, testPrompt);
        break;
      case "cerebras":
        reply = await callCerebras(key, mod, testPrompt);
        break;
      case "sambanova":
        reply = await callSambaNova(key, mod, testPrompt);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    return { valid: true, reply };
  }
