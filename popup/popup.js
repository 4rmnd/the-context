// ─── THE CONTEXT — POPUP CONTROLLER ───────────────────────────────────────────
// Handles autoscan, real-time message navigation, model discovery/verification,
// round-robin rotation indicator, and enhanced history management.

document.addEventListener("DOMContentLoaded", async () => {
  // ── UI ELEMENTS ─────────────────────────────────────────────────────────────
  const tabs = document.querySelectorAll(".nav-btn");
  const panels = document.querySelectorAll(".tab-panel");

  const platformPill = document.getElementById("platform-pill");
  const platformIconWrapper = document.getElementById("platform-icon-wrapper");
  const platformName = document.getElementById("platform-name");

  // Generator Panel
  const detectedSiteLabel = document.getElementById("detected-site-label");
  const scrapedCountLabel = document.getElementById("scraped-count-label");

  const routingStatusBadge = document.getElementById("routing-status-badge");
  const routingModeLabel = document.getElementById("routing-mode-label");
  const routingNextPill = document.getElementById("routing-next-pill");

  const btnGenerate = document.getElementById("btn-generate");
  const spinner = btnGenerate.querySelector(".spinner");
  const btnText = btnGenerate.querySelector(".btn-text");

  const resultWrapper = document.getElementById("result-wrapper");
  const providerBadge = document.getElementById("provider-badge");
  const modelBadge = document.getElementById("model-badge");
  const promptOutput = document.getElementById("prompt-output");
  const promptPreviewContent = document.getElementById("prompt-preview-content");
  const btnTogglePreview = document.getElementById("btn-toggle-preview");
  const btnCopy = document.getElementById("btn-copy");
  const copyIcon = btnCopy.querySelector(".copy-icon");
  const copySuccessCheck = btnCopy.querySelector(".copy-success-check");

  const toast = document.getElementById("toast");
  const errorBanner = document.getElementById("error-banner");

  // History Panel
  const historySearch = document.getElementById("history-search");
  const filterChips = document.querySelectorAll(".chip");
  const btnExportHistory = document.getElementById("btn-export-history");
  const btnClearHistory = document.getElementById("btn-clear-history");
  const historyEmpty = document.getElementById("history-empty");
  const historyItemsContainer = document.getElementById("history-items");

  // Settings Panel
  const settingsForm = document.getElementById("settings-form");
  const routingModeSelect = document.getElementById("routing-mode-select");
  const routingModeDesc = document.getElementById("routing-mode-desc");
  const diagramTitle = document.getElementById("diagram-title");
  const diagramPipeline = document.getElementById("diagram-pipeline");
  const diagramHint = document.getElementById("diagram-hint");
  const btnSaveSettings = document.getElementById("btn-save-settings");

  // Provider Inputs
  const geminiKeyInput = document.getElementById("gemini-key");
  const geminiModelSelect = document.getElementById("gemini-model-select");
  const geminiCustomWrapper = document.getElementById("gemini-custom-wrapper");
  const geminiCustomModel = document.getElementById("gemini-custom-model");

  const groqKeyInput = document.getElementById("groq-key");
  const groqModelSelect = document.getElementById("groq-model-select");
  const groqCustomWrapper = document.getElementById("groq-custom-wrapper");
  const groqCustomModel = document.getElementById("groq-custom-model");

  const deepseekKeyInput = document.getElementById("deepseek-key");
  const deepseekModelSelect = document.getElementById("deepseek-model-select");
  const deepseekCustomWrapper = document.getElementById("deepseek-custom-wrapper");
  const deepseekCustomModel = document.getElementById("deepseek-custom-model");

  const openrouterKeyInput = document.getElementById("openrouter-key");
  const openrouterModelSelect = document.getElementById("openrouter-model-select");
  const openrouterCustomWrapper = document.getElementById("openrouter-custom-wrapper");
  const openrouterCustomModel = document.getElementById("openrouter-custom-model");

  const openaiKeyInput = document.getElementById("openai-key");
  const openaiModelSelect = document.getElementById("openai-model-select");
  const openaiCustomWrapper = document.getElementById("openai-custom-wrapper");
  const openaiCustomModel = document.getElementById("openai-custom-model");

  // NVIDIA NIM
  const nvidiaKeyInput = document.getElementById("nvidia-key");
  const nvidiaModelSelect = document.getElementById("nvidia-model-select");
  const nvidiaCustomWrapper = document.getElementById("nvidia-custom-wrapper");
  const nvidiaCustomModel = document.getElementById("nvidia-custom-model");

  // Ollama
  const ollamaEndpointInput = document.getElementById("ollama-endpoint");
  const ollamaKeyInput = document.getElementById("ollama-key");
  const ollamaModelSelect = document.getElementById("ollama-model-select");
  const ollamaCustomWrapper = document.getElementById("ollama-custom-wrapper");
  const ollamaCustomModel = document.getElementById("ollama-custom-model");

  // Mistral
  const mistralKeyInput = document.getElementById("mistral-key");
  const mistralModelSelect = document.getElementById("mistral-model-select");
  const mistralCustomWrapper = document.getElementById("mistral-custom-wrapper");
  const mistralCustomModel = document.getElementById("mistral-custom-model");

  // Cerebras
  const cerebrasKeyInput = document.getElementById("cerebras-key");
  const cerebrasModelSelect = document.getElementById("cerebras-model-select");
  const cerebrasCustomWrapper = document.getElementById("cerebras-custom-wrapper");
  const cerebrasCustomModel = document.getElementById("cerebras-custom-model");

  // SambaNova
  const sambanovaKeyInput = document.getElementById("sambanova-key");
  const sambanovaModelSelect = document.getElementById("sambanova-model-select");
  const sambanovaCustomWrapper = document.getElementById("sambanova-custom-wrapper");
  const sambanovaCustomModel = document.getElementById("sambanova-custom-model");

  const maxMessagesInput = document.getElementById("max-messages");
  const maxMessagesVal = document.getElementById("max-messages-val");
  const maxMessagesAllCheckbox = document.getElementById("max-messages-all");
  const presetButtons = document.querySelectorAll(".btn-preset");

  // ── STATE ───────────────────────────────────────────────────────────────────
  let activeTabId = null;
  let detectedPlatform = "Unknown";
  let scrapedRawText = "";
  let scannedMessages = [];
  let activeHistoryFilter = "all";

  let settings = {
    routingMode: "cascade",
    geminiKey: "",
    geminiModel: "gemini-2.0-flash",
    groqKey: "",
    groqModel: "llama-3.3-70b-versatile",
    deepseekKey: "",
    deepseekModel: "deepseek-chat",
    openrouterKey: "",
    openrouterModel: "google/gemini-2.0-flash:free",
    openaiKey: "",
    openaiModel: "gpt-4o-mini",
    nvidiaKey: "",
    nvidiaModel: "meta/llama-3.3-70b-instruct",
    ollamaEndpoint: "http://localhost:11434/v1",
    ollamaKey: "",
    ollamaModel: "llama3.3:latest",
    mistralKey: "",
    mistralModel: "mistral-large-latest",
    cerebrasKey: "",
    cerebrasModel: "llama-3.3-70b",
    sambanovaKey: "",
    sambanovaModel: "Meta-Llama-3.3-70B-Instruct",
    maxMessages: 50,
    maxMessagesAll: false
  };

  // ── TAB NAVIGATION ──────────────────────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      if (target) target.classList.add("active");

      if (tab.dataset.tab === "history") {
        loadHistory();
      }
    });
  });

  // ── INITIALIZE SETTINGS ─────────────────────────────────────────────────────
  async function loadSettings() {
    const loaded = await chrome.storage.local.get([
      "routingMode",
      "roundRobinIndex",
      "geminiKey", "geminiModel", "cachedModels_gemini",
      "groqKey", "groqModel", "cachedModels_groq",
      "deepseekKey", "deepseekModel", "cachedModels_deepseek",
      "openrouterKey", "openrouterModel", "cachedModels_openrouter",
      "openaiKey", "openaiModel", "cachedModels_openai",
      "nvidiaKey", "nvidiaModel", "cachedModels_nvidia",
      "ollamaEndpoint", "ollamaKey", "ollamaModel", "cachedModels_ollama",
      "mistralKey", "mistralModel", "cachedModels_mistral",
      "cerebrasKey", "cerebrasModel", "cachedModels_cerebras",
      "sambanovaKey", "sambanovaModel", "cachedModels_sambanova",
      "maxMessages", "maxMessagesAll"
    ]);

    Object.keys(settings).forEach(k => {
      if (loaded[k] !== undefined) settings[k] = loaded[k];
    });

    // Populate Settings UI
    if (routingModeSelect) routingModeSelect.value = settings.routingMode || "cascade";
    updateRoutingUI(settings.routingMode || "cascade");

    // Populate Provider inputs, cached models & model selectors
    setupProviderField("gemini", geminiKeyInput, geminiModelSelect, geminiCustomWrapper, geminiCustomModel, settings.geminiKey, settings.geminiModel, loaded.cachedModels_gemini);
    setupProviderField("groq", groqKeyInput, groqModelSelect, groqCustomWrapper, groqCustomModel, settings.groqKey, settings.groqModel, loaded.cachedModels_groq);
    setupProviderField("deepseek", deepseekKeyInput, deepseekModelSelect, deepseekCustomWrapper, deepseekCustomModel, settings.deepseekKey, settings.deepseekModel, loaded.cachedModels_deepseek);
    setupProviderField("openrouter", openrouterKeyInput, openrouterModelSelect, openrouterCustomWrapper, openrouterCustomModel, settings.openrouterKey, settings.openrouterModel, loaded.cachedModels_openrouter);
    setupProviderField("openai", openaiKeyInput, openaiModelSelect, openaiCustomWrapper, openaiCustomModel, settings.openaiKey, settings.openaiModel, loaded.cachedModels_openai);

    setupProviderField("nvidia", nvidiaKeyInput, nvidiaModelSelect, nvidiaCustomWrapper, nvidiaCustomModel, settings.nvidiaKey, settings.nvidiaModel, loaded.cachedModels_nvidia);

    if (ollamaEndpointInput) ollamaEndpointInput.value = settings.ollamaEndpoint || "http://localhost:11434/v1";
    setupProviderField("ollama", ollamaKeyInput, ollamaModelSelect, ollamaCustomWrapper, ollamaCustomModel, settings.ollamaKey, settings.ollamaModel, loaded.cachedModels_ollama);

    setupProviderField("mistral", mistralKeyInput, mistralModelSelect, mistralCustomWrapper, mistralCustomModel, settings.mistralKey, settings.mistralModel, loaded.cachedModels_mistral);
    setupProviderField("cerebras", cerebrasKeyInput, cerebrasModelSelect, cerebrasCustomWrapper, cerebrasCustomModel, settings.cerebrasKey, settings.cerebrasModel, loaded.cachedModels_cerebras);
    setupProviderField("sambanova", sambanovaKeyInput, sambanovaModelSelect, sambanovaCustomWrapper, sambanovaCustomModel, settings.sambanovaKey, settings.sambanovaModel, loaded.cachedModels_sambanova);

    // Messages slider
    maxMessagesInput.value = settings.maxMessages;
    maxMessagesVal.textContent = settings.maxMessagesAll ? "All" : settings.maxMessages;
    maxMessagesAllCheckbox.checked = settings.maxMessagesAll;
    if (settings.maxMessagesAll) {
      maxMessagesInput.disabled = true;
      maxMessagesInput.style.opacity = "0.4";
    }

    // Update Generator Badge & Dots
    updateRoutingStatusBadge();
    updateProviderDots();
  }

  function populateModelSelect(selectEl, models) {
    if (!selectEl || !Array.isArray(models) || models.length === 0) return;
    const currentVal = selectEl.value;
    selectEl.innerHTML = "";

    models.forEach(modelId => {
      const opt = document.createElement("option");
      opt.value = modelId;
      opt.textContent = modelId;
      selectEl.appendChild(opt);
    });

    const customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.textContent = "Custom Model...";
    selectEl.appendChild(customOpt);

    if (models.includes(currentVal)) {
      selectEl.value = currentVal;
    }
  }

  function setupProviderField(provName, keyInput, selectEl, customWrapper, customInput, keyVal, modelVal, cachedModels) {
    if (keyInput) keyInput.value = keyVal || "";
    if (!selectEl) return;

    // 1. If cached models exist, populate dropdown and restore status badge!
    if (Array.isArray(cachedModels) && cachedModels.length > 0) {
      populateModelSelect(selectEl, cachedModels);
      const statusEl = document.getElementById(`fetch-status-${provName}`);
      if (statusEl) {
        statusEl.className = "fetch-status success";
        statusEl.textContent = `✅ ${cachedModels.length} models`;
        statusEl.title = `${cachedModels.length} models restored from previous fetch`;
      }
    }

    // 2. Check if modelVal exists in options
    let exists = false;
    for (let i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === modelVal) {
        exists = true;
        break;
      }
    }

    if (exists) {
      selectEl.value = modelVal;
      if (customWrapper) customWrapper.classList.add("hidden");
      if (customInput) customInput.value = "";
    } else if (modelVal) {
      selectEl.value = "custom";
      if (customWrapper) customWrapper.classList.remove("hidden");
      if (customInput) customInput.value = modelVal;
    }

    // 3. Auto-save on dropdown change
    selectEl.addEventListener("change", async () => {
      const chosenModel = selectEl.value === "custom" ? (customInput?.value || "").trim() : selectEl.value;
      settings[`${provName}Model`] = chosenModel;
      await chrome.storage.local.set({ [`${provName}Model`]: chosenModel });

      if (selectEl.value === "custom") {
        if (customWrapper) customWrapper.classList.remove("hidden");
        if (customInput) customInput.focus();
      } else {
        if (customWrapper) customWrapper.classList.add("hidden");
      }
    });

    // 4. Auto-save on custom text typing
    if (customInput) {
      customInput.addEventListener("input", async () => {
        if (selectEl.value === "custom") {
          const customVal = customInput.value.trim();
          settings[`${provName}Model`] = customVal;
          await chrome.storage.local.set({ [`${provName}Model`]: customVal });
        }
      });
    }
  }

  function updateRoutingStatusBadge() {
    if (settings.routingMode === "round-robin") {
      routingModeLabel.textContent = "Round-Robin Rotation";
      routingNextPill.classList.remove("hidden");
      routingNextPill.textContent = "Auto-Rotating ↻";
    } else if (settings.routingMode === "fusion") {
      routingModeLabel.textContent = "Fusion (Panel + Judge)";
      routingNextPill.classList.remove("hidden");
      routingNextPill.textContent = "Parallel ⚡";
    } else {
      routingModeLabel.textContent = "Cascading Fallback";
      routingNextPill.classList.add("hidden");
    }
  }

  function updateRoutingUI(mode) {
    if (!routingModeSelect) return;
    routingModeSelect.value = mode;

    if (mode === "round-robin") {
      if (routingModeDesc) {
        routingModeDesc.textContent = "Cycles between configured AI models on each generation to distribute quota evenly.";
      }
      if (diagramTitle) diagramTitle.textContent = "Model Cycle Architecture";
      if (diagramPipeline) {
        diagramPipeline.innerHTML = `
          <div class="diagram-node">
            <span class="node-badge">1</span>
            <span class="node-name">Gemini</span>
          </div>
          <div class="diagram-arrow">➔</div>
          <div class="diagram-node">
            <span class="node-badge">2</span>
            <span class="node-name">Groq</span>
          </div>
          <div class="diagram-arrow">➔</div>
          <div class="diagram-node">
            <span class="node-badge">3</span>
            <span class="node-name">DeepSeek</span>
          </div>
          <div class="diagram-arrow">➔</div>
          <div class="diagram-node">
            <span class="node-badge">↻</span>
            <span class="node-name">Loop</span>
          </div>
        `;
      }
      if (diagramHint) {
        diagramHint.textContent = "Distributes load across providers turn-by-turn. If any provider hits quota (429), it automatically cascades to the next candidate.";
      }
    } else if (mode === "fusion") {
      if (routingModeDesc) {
        routingModeDesc.textContent = "Dispatches prompt concurrently to active providers (Panel) and takes the fastest verified output (Judge).";
      }
      if (diagramTitle) diagramTitle.textContent = "Parallel Panel Consensus";
      if (diagramPipeline) {
        diagramPipeline.innerHTML = `
          <div class="diagram-node">
            <span class="node-badge">⚡</span>
            <span class="node-name">Gemini</span>
          </div>
          <div class="diagram-arrow">+</div>
          <div class="diagram-node">
            <span class="node-badge">⚡</span>
            <span class="node-name">Groq</span>
          </div>
          <div class="diagram-arrow">➔</div>
          <div class="diagram-node">
            <span class="node-badge">🏆</span>
            <span class="node-name">Fastest / Best</span>
          </div>
        `;
      }
      if (diagramHint) {
        diagramHint.textContent = "Parallel race: multiple models compute simultaneously. Returns the fastest response with zero waiting time.";
      }
    } else {
      // cascade
      if (routingModeDesc) {
        routingModeDesc.textContent = "Primary provider first ➔ Seamlessly fails over to next candidate on rate limits or errors.";
      }
      if (diagramTitle) diagramTitle.textContent = "Fallback Pipeline";
      if (diagramPipeline) {
        diagramPipeline.innerHTML = `
          <div class="diagram-node">
            <span class="node-badge">1</span>
            <span class="node-name">Primary</span>
          </div>
          <div class="diagram-arrow">➔</div>
          <div class="diagram-node">
            <span class="node-badge">2</span>
            <span class="node-name">Fallback 1</span>
          </div>
          <div class="diagram-arrow">➔</div>
          <div class="diagram-node">
            <span class="node-badge">3</span>
            <span class="node-name">Fallback 2</span>
          </div>
        `;
      }
      if (diagramHint) {
        diagramHint.textContent = "Tries Primary first. If quota limit or error occurs, instantly fails over to Fallback 1, then Fallback 2.";
      }
    }
  }

  if (routingModeSelect) {
    routingModeSelect.addEventListener("change", () => {
      const mode = routingModeSelect.value;
      settings.routingMode = mode;
      updateRoutingUI(mode);
      updateRoutingStatusBadge();
    });
  }

  // ── PROVIDER SUBNAV TABS ────────────────────────────────────────────────────
  const provTabs = document.querySelectorAll(".prov-tab");
  const provPanels = document.querySelectorAll(".prov-panel");

  provTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      provTabs.forEach(t => t.classList.remove("active"));
      provPanels.forEach(p => p.classList.add("hidden"));

      tab.classList.add("active");
      const targetProv = tab.dataset.prov;
      const targetPanel = document.getElementById(`prov-panel-${targetProv}`);
      if (targetPanel) targetPanel.classList.remove("hidden");
    });
  });

  function updateProviderDots() {
    updateDot("gemini", geminiKeyInput?.value);
    updateDot("groq", groqKeyInput?.value);
    updateDot("deepseek", deepseekKeyInput?.value);
    updateDot("openrouter", openrouterKeyInput?.value);
    updateDot("openai", openaiKeyInput?.value);
    updateDot("nvidia", nvidiaKeyInput?.value);
    updateDot("ollama", (ollamaEndpointInput?.value && ollamaEndpointInput?.value.trim() !== "http://localhost:11434/v1") ? ollamaEndpointInput?.value : (ollamaKeyInput?.value || "configured"));
    updateDot("mistral", mistralKeyInput?.value);
    updateDot("cerebras", cerebrasKeyInput?.value);
    updateDot("sambanova", sambanovaKeyInput?.value);
  }

  function updateDot(provider, keyVal) {
    const dot = document.getElementById(`dot-${provider}`);
    if (!dot) return;
    if (keyVal && keyVal.trim().length > 3) {
      dot.classList.remove("hidden");
    } else {
      dot.classList.add("hidden");
    }
  }

  [
    geminiKeyInput, groqKeyInput, deepseekKeyInput, openrouterKeyInput, openaiKeyInput,
    nvidiaKeyInput, ollamaEndpointInput, ollamaKeyInput, mistralKeyInput, cerebrasKeyInput, sambanovaKeyInput
  ].forEach(inp => {
    if (inp) inp.addEventListener("input", updateProviderDots);
  });

  await loadSettings();

  // ── PASSWORD VISIBILITY TOGGLE ──────────────────────────────────────────────
  document.querySelectorAll(".btn-toggle-visibility").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetInput = document.getElementById(btn.dataset.target);
      if (!targetInput) return;
      if (targetInput.type === "password") {
        targetInput.type = "text";
        btn.textContent = "🙈";
      } else {
        targetInput.type = "password";
        btn.textContent = "👁️";
      }
    });
  });

  // ── SLIDER & PRESETS ────────────────────────────────────────────────────────
  maxMessagesInput.addEventListener("input", (e) => {
    if (!maxMessagesAllCheckbox.checked) {
      maxMessagesVal.textContent = e.target.value;
    }
  });

  maxMessagesAllCheckbox.addEventListener("change", () => {
    if (maxMessagesAllCheckbox.checked) {
      maxMessagesVal.textContent = "All";
      maxMessagesInput.disabled = true;
      maxMessagesInput.style.opacity = "0.4";
    } else {
      maxMessagesVal.textContent = maxMessagesInput.value;
      maxMessagesInput.disabled = false;
      maxMessagesInput.style.opacity = "1";
    }
  });

  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = parseInt(btn.dataset.preset, 10);
      maxMessagesAllCheckbox.checked = false;
      maxMessagesInput.disabled = false;
      maxMessagesInput.style.opacity = "1";
      maxMessagesInput.value = preset;
      maxMessagesVal.textContent = preset;
      showToast(`Context set to ${preset} messages`);
    });
  });

  // ── AUTOSCAN CHAT CONVERSATION ──────────────────────────────────────────────
  async function performScan() {
    try {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabs.length === 0) return;

      const activeTab = activeTabs[0];
      activeTabId = activeTab.id;
      const url = (activeTab.url || "").toLowerCase();

      let platform = "Unknown";
      if (url.includes("claude.ai")) platform = "Claude";
      else if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) platform = "ChatGPT";
      else if (url.includes("gemini.google.com")) platform = "Gemini";
      else if (url.includes("deepseek.com")) platform = "DeepSeek";
      else if (url.includes("perplexity.ai")) platform = "Perplexity";
      else if (url.includes("mistral.ai")) platform = "Mistral";
      else if (url.includes("copilot.microsoft")) platform = "Copilot";
      else if (url.includes("grok.com") || url.includes("/grok")) platform = "Grok";
      else if (url.includes("poe.com")) platform = "Poe";
      else if (url.includes("huggingface.co")) platform = "HuggingChat";
      else if (url.startsWith("http")) platform = "AI Chat";

      detectedPlatform = platform;
      updatePlatformUI(platform);

      if (platform === "Unknown") {
        detectedSiteLabel.textContent = "Tab is not a supported AI session";
        scrapedCountLabel.textContent = "-";
        btnGenerate.disabled = true;
        return;
      }

      detectedSiteLabel.textContent = `${platform} Session`;
      scrapedCountLabel.textContent = "Scanning active conversation...";

      chrome.tabs.sendMessage(activeTabId, { action: "scan_chat" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Scan failed, injecting content script manually...", chrome.runtime.lastError);
          attemptScriptInjection(activeTabId);
          return;
        }
        handleScanResponse(response);
      });
    } catch (err) {
      console.error("Autoscan error:", err);
      scrapedCountLabel.textContent = "Scan error";
    }
  }

  async function attemptScriptInjection(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/content.js"]
      });

      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: "scan_chat" }, (response) => {
          if (chrome.runtime.lastError) {
            scrapedCountLabel.textContent = "Please refresh page";
            showError("Could not connect to page. Please refresh the AI chat tab.");
            return;
          }
          handleScanResponse(response);
        });
      }, 300);
    } catch (err) {
      scrapedCountLabel.textContent = "Refresh page";
      showError("Please refresh the AI chat tab to enable scanning.");
    }
  }

  function handleScanResponse(response) {
    if (response && response.success && response.rawText) {
      scrapedRawText = response.rawText;
      scannedMessages = response.messages || [];
      const count = response.messageCount || scannedMessages.length || 0;

      scrapedCountLabel.textContent = `${count} messages detected`;
      btnGenerate.disabled = false;
      errorBanner.classList.add("hidden");
    } else {
      scrapedRawText = "";
      scannedMessages = [];
      scrapedCountLabel.textContent = "0 messages found";
      btnGenerate.disabled = true;
      showError(response?.error || "No active messages detected in this conversation.");
    }
  }

  function updatePlatformUI(platform) {
    platformPill.className = "platform-pill " + platform.toLowerCase();
    platformName.textContent = platform;

    // Platform icons (native badges / symbols)
    const icons = {
      Claude: "🟣",
      ChatGPT: "🟢",
      Gemini: "✨",
      DeepSeek: "🐋",
      Perplexity: "🔍",
      Mistral: "🌪️",
      Copilot: "🤖",
      Grok: "⚡",
      Poe: "🪶",
      HuggingChat: "🤗"
    };

    platformIconWrapper.textContent = icons[platform] || "💬";
  }

  // ── GENERATE CONTINUATION PROMPT ────────────────────────────────────────────
  btnGenerate.addEventListener("click", () => {
    if (!scrapedRawText) return;

    btnGenerate.disabled = true;
    spinner.classList.remove("hidden");
    btnText.textContent = "Synthesizing Context...";
    resultWrapper.classList.add("hidden");
    errorBanner.classList.add("hidden");

    const effectiveLimit = maxMessagesAllCheckbox.checked ? 0 : parseInt(maxMessagesInput.value, 10);

    chrome.runtime.sendMessage({
      action: "generate_prompt",
      rawText: scrapedRawText,
      platform: detectedPlatform,
      maxMessages: effectiveLimit
    }, (response) => {
      btnGenerate.disabled = false;
      spinner.classList.add("hidden");
      btnText.textContent = "Generate Continuation Prompt";

      if (chrome.runtime.lastError) {
        showError("Worker Error: " + chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        promptOutput.value = response.prompt;
        promptPreviewContent.textContent = response.prompt;
        providerBadge.textContent = response.providerUsed || "AI";
        modelBadge.textContent = response.modelUsed || "";
        resultWrapper.classList.remove("hidden");

        // Save entry to History
        saveToHistory(detectedPlatform, response.prompt, response.providerUsed, response.modelUsed);
      } else {
        showError(response?.error || "Failed to generate continuation prompt.");
      }
    });
  });

  // Toggle preview expand/collapse
  btnTogglePreview.addEventListener("click", () => {
    const isCollapsed = promptPreviewContent.classList.toggle("collapsed");
    btnTogglePreview.textContent = isCollapsed ? "Expand" : "Collapse";
  });

  // Copy Prompt CTA
  btnCopy.addEventListener("click", () => {
    const text = promptOutput.value;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      copyIcon.classList.add("hidden");
      copySuccessCheck.classList.remove("hidden");
      showToast("Continuation Prompt copied to clipboard!");

      setTimeout(() => {
        copyIcon.classList.remove("hidden");
        copySuccessCheck.classList.add("hidden");
      }, 2200);
    }).catch(err => {
      showError("Copy failed: " + err.message);
    });
  });

  // ── LIVE MODEL FETCHING & VERIFICATION (SETTINGS) ───────────────────────────
  async function fetchModelsDirect(provider, apiKey) {
    const prov = (provider || "").toLowerCase().trim();
    const key = (apiKey || "").replace(/[\r\n\t\s'"]/g, "").trim();

    if (!key && prov !== "openrouter") {
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

        try {
          const res = await fetch(`${base}/api/tags`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.models) && data.models.length > 0) {
              return data.models.map(m => m.name || m.model).filter(Boolean);
            }
          }
        } catch (_) {}

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

  function setupModelFetcher(btnId, provider, keyInput, selectEl, customWrapper, customInput, endpointInput) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const provLower = provider.toLowerCase();
    const statusEl = document.getElementById(`fetch-status-${provLower}`);

    btn.addEventListener("click", async () => {
      const rawKey = keyInput ? keyInput.value : "";
      const cleanKey = (rawKey || "").replace(/[\r\n\t\s'"]/g, "").trim();
      const endpoint = endpointInput ? endpointInput.value.trim() : "";

      if (!cleanKey && provLower !== "openrouter" && provLower !== "ollama") {
        if (statusEl) {
          statusEl.className = "fetch-status error";
          statusEl.textContent = "Key required";
          statusEl.title = `Please enter your ${provider} API key first.`;
        }
        showToast(`Please enter your ${provider} API key first.`);
        if (keyInput) keyInput.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = "Fetching...";
      if (statusEl) {
        statusEl.className = "fetch-status loading";
        statusEl.textContent = "Fetching...";
        statusEl.title = `Connecting to ${provider} API...`;
      }

      let models = [];
      let lastError = null;

      // 1. Try background worker first (bypasses any popup context limitations)
      try {
        const bgResp = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: "fetch_models",
            provider: provLower,
            apiKey: cleanKey,
            endpoint
          }, (r) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (r && r.success && Array.isArray(r.models) && r.models.length > 0) {
              resolve(r.models);
            } else {
              reject(new Error(r?.error || "Fetch failed"));
            }
          });
        });
        models = bgResp;
      } catch (bgErr) {
        lastError = bgErr;
        // 2. Fallback to direct fetch
        try {
          models = await fetchModelsDirect(provLower, cleanKey, endpoint);
        } catch (directErr) {
          const msgBg = lastError?.message || "";
          if (msgBg && !msgBg.includes("closed") && !msgBg.includes("Receiving end does not exist")) {
            lastError = lastError;
          } else {
            lastError = directErr;
          }
        }
      }

      btn.disabled = false;
      btn.textContent = "⚡ Fetch Models";

      if (models && models.length > 0) {
        const currentVal = selectEl.value;
        selectEl.innerHTML = "";

        models.forEach(modelId => {
          const opt = document.createElement("option");
          opt.value = modelId;
          opt.textContent = modelId;
          selectEl.appendChild(opt);
        });

        // Add custom option
        const customOpt = document.createElement("option");
        customOpt.value = "custom";
        customOpt.textContent = "Custom Model...";
        selectEl.appendChild(customOpt);

        if (models.includes(currentVal)) {
          selectEl.value = currentVal;
        } else {
          selectEl.value = models[0];
        }

        if (selectEl.value !== "custom" && customWrapper) {
          customWrapper.classList.add("hidden");
        }

        // Persist to current settings and chrome.storage.local
        settings[`${provLower}Model`] = selectEl.value;
        await chrome.storage.local.set({
          [`cachedModels_${provLower}`]: models,
          [`${provLower}Model`]: selectEl.value
        });

        if (statusEl) {
          statusEl.className = "fetch-status success";
          statusEl.textContent = `✅ ${models.length} models`;
          statusEl.title = `Successfully loaded ${models.length} verified models for ${provider}`;
        }

        selectEl.classList.add("select-pulse-success");
        setTimeout(() => selectEl.classList.remove("select-pulse-success"), 1500);

        showToast(`Loaded ${models.length} verified models for ${provider}!`);
      } else {
        const errDetail = lastError?.message || "Failed to retrieve models.";
        if (statusEl) {
          statusEl.className = "fetch-status error";
          const shortErr = errDetail.length > 20 ? errDetail.slice(0, 18) + "..." : errDetail;
          statusEl.textContent = `❌ ${shortErr}`;
          statusEl.title = errDetail;
        }
        showToast(`Fetch error: ${errDetail}`);
      }
    });
  }

  setupModelFetcher("btn-fetch-gemini-models", "Gemini", geminiKeyInput, geminiModelSelect, geminiCustomWrapper, geminiCustomModel);
  setupModelFetcher("btn-fetch-groq-models", "Groq", groqKeyInput, groqModelSelect, groqCustomWrapper, groqCustomModel);
  setupModelFetcher("btn-fetch-deepseek-models", "DeepSeek", deepseekKeyInput, deepseekModelSelect, deepseekCustomWrapper, deepseekCustomModel);
  setupModelFetcher("btn-fetch-openrouter-models", "OpenRouter", openrouterKeyInput, openrouterModelSelect, openrouterCustomWrapper, openrouterCustomModel);
  setupModelFetcher("btn-fetch-openai-models", "OpenAI", openaiKeyInput, openaiModelSelect, openaiCustomWrapper, openaiCustomModel);
  setupModelFetcher("btn-fetch-nvidia-models", "NVIDIA", nvidiaKeyInput, nvidiaModelSelect, nvidiaCustomWrapper, nvidiaCustomModel);
  setupModelFetcher("btn-fetch-ollama-models", "Ollama", ollamaKeyInput, ollamaModelSelect, ollamaCustomWrapper, ollamaCustomModel, ollamaEndpointInput);
  setupModelFetcher("btn-fetch-mistral-models", "Mistral", mistralKeyInput, mistralModelSelect, mistralCustomWrapper, mistralCustomModel);
  setupModelFetcher("btn-fetch-cerebras-models", "Cerebras", cerebrasKeyInput, cerebrasModelSelect, cerebrasCustomWrapper, cerebrasCustomModel);
  setupModelFetcher("btn-fetch-sambanova-models", "SambaNova", sambanovaKeyInput, sambanovaModelSelect, sambanovaCustomWrapper, sambanovaCustomModel);

  // Model Verification Buttons
  document.querySelectorAll(".btn-verify-model").forEach(btn => {
    btn.addEventListener("click", () => {
      const provider = btn.dataset.provider;
      const statusEl = document.getElementById(`verify-status-${provider}`);

      let key = "";
      let model = "";
      let endpoint = "";

      if (provider === "gemini") {
        key = geminiKeyInput.value.trim();
        model = geminiModelSelect.value === "custom" ? geminiCustomModel.value.trim() : geminiModelSelect.value;
      } else if (provider === "groq") {
        key = groqKeyInput.value.trim();
        model = groqModelSelect.value === "custom" ? groqCustomModel.value.trim() : groqModelSelect.value;
      } else if (provider === "deepseek") {
        key = deepseekKeyInput.value.trim();
        model = deepseekModelSelect.value === "custom" ? deepseekCustomModel.value.trim() : deepseekModelSelect.value;
      } else if (provider === "openrouter") {
        key = openrouterKeyInput.value.trim();
        model = openrouterModelSelect.value === "custom" ? openrouterCustomModel.value.trim() : openrouterModelSelect.value;
      } else if (provider === "openai") {
        key = openaiKeyInput.value.trim();
        model = openaiModelSelect.value === "custom" ? openaiCustomModel.value.trim() : openaiModelSelect.value;
      } else if (provider === "nvidia") {
        key = nvidiaKeyInput.value.trim();
        model = nvidiaModelSelect.value === "custom" ? nvidiaCustomModel.value.trim() : nvidiaModelSelect.value;
      } else if (provider === "ollama") {
        endpoint = ollamaEndpointInput ? ollamaEndpointInput.value.trim() : "";
        key = ollamaKeyInput ? ollamaKeyInput.value.trim() : "";
        model = ollamaModelSelect.value === "custom" ? ollamaCustomModel.value.trim() : ollamaModelSelect.value;
      } else if (provider === "mistral") {
        key = mistralKeyInput.value.trim();
        model = mistralModelSelect.value === "custom" ? mistralCustomModel.value.trim() : mistralModelSelect.value;
      } else if (provider === "cerebras") {
        key = cerebrasKeyInput.value.trim();
        model = cerebrasModelSelect.value === "custom" ? cerebrasCustomModel.value.trim() : cerebrasModelSelect.value;
      } else if (provider === "sambanova") {
        key = sambanovaKeyInput.value.trim();
        model = sambanovaModelSelect.value === "custom" ? sambanovaCustomModel.value.trim() : sambanovaModelSelect.value;
      }

      if (!key && provider !== "ollama") {
        showToast("Please enter an API key first.");
        return;
      }

      statusEl.className = "verification-status loading";
      statusEl.textContent = "Testing ping...";
      btn.disabled = true;

      chrome.runtime.sendMessage({
        action: "verify_model",
        provider,
        model,
        apiKey: key,
        endpoint
      }, (res) => {
        btn.disabled = false;
        if (chrome.runtime.lastError) {
          statusEl.className = "verification-status error";
          statusEl.innerHTML = `<span class="verif-err-icon">❌</span><span class="verif-err-text">${escapeHtml(chrome.runtime.lastError.message)}</span>`;
          return;
        }
        if (res && res.success && res.valid) {
          statusEl.className = "verification-status success";
          statusEl.textContent = "✅ Active & Ready";
        } else {
          statusEl.className = "verification-status error";
          const rawErr = (res?.error || "Verification failed").replace(/^Error:\s*/, "");
          statusEl.innerHTML = `<span class="verif-err-icon">❌</span><span class="verif-err-text">${escapeHtml(rawErr)}</span>`;
        }
      });
    });
  });

  // ── SAVE SETTINGS FORM ──────────────────────────────────────────────────────
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const routingMode = routingModeSelect ? routingModeSelect.value : "cascade";

    const geminiKey = geminiKeyInput.value.trim();
    const geminiModel = geminiModelSelect.value === "custom" ? geminiCustomModel.value.trim() : geminiModelSelect.value;

    const groqKey = groqKeyInput.value.trim();
    const groqModel = groqModelSelect.value === "custom" ? groqCustomModel.value.trim() : groqModelSelect.value;

    const deepseekKey = deepseekKeyInput.value.trim();
    const deepseekModel = deepseekModelSelect.value === "custom" ? deepseekCustomModel.value.trim() : deepseekModelSelect.value;

    const openrouterKey = openrouterKeyInput.value.trim();
    const openrouterModel = openrouterModelSelect.value === "custom" ? openrouterCustomModel.value.trim() : openrouterModelSelect.value;

    const openaiKey = openaiKeyInput.value.trim();
    const openaiModel = openaiModelSelect.value === "custom" ? openaiCustomModel.value.trim() : openaiModelSelect.value;

    const nvidiaKey = nvidiaKeyInput ? nvidiaKeyInput.value.trim() : "";
    const nvidiaModel = nvidiaModelSelect.value === "custom" ? nvidiaCustomModel.value.trim() : nvidiaModelSelect.value;

    const ollamaEndpoint = ollamaEndpointInput ? ollamaEndpointInput.value.trim() : "http://localhost:11434/v1";
    const ollamaKey = ollamaKeyInput ? ollamaKeyInput.value.trim() : "";
    const ollamaModel = ollamaModelSelect.value === "custom" ? ollamaCustomModel.value.trim() : ollamaModelSelect.value;

    const mistralKey = mistralKeyInput ? mistralKeyInput.value.trim() : "";
    const mistralModel = mistralModelSelect.value === "custom" ? mistralCustomModel.value.trim() : mistralModelSelect.value;

    const cerebrasKey = cerebrasKeyInput ? cerebrasKeyInput.value.trim() : "";
    const cerebrasModel = cerebrasModelSelect.value === "custom" ? cerebrasCustomModel.value.trim() : cerebrasModelSelect.value;

    const sambanovaKey = sambanovaKeyInput ? sambanovaKeyInput.value.trim() : "";
    const sambanovaModel = sambanovaModelSelect.value === "custom" ? sambanovaCustomModel.value.trim() : sambanovaModelSelect.value;

    const maxMessages = parseInt(maxMessagesInput.value, 10);
    const maxMessagesAll = maxMessagesAllCheckbox.checked;

    settings = {
      routingMode,
      geminiKey, geminiModel,
      groqKey, groqModel,
      deepseekKey, deepseekModel,
      openrouterKey, openrouterModel,
      openaiKey, openaiModel,
      nvidiaKey, nvidiaModel,
      ollamaEndpoint, ollamaKey, ollamaModel,
      mistralKey, mistralModel,
      cerebrasKey, cerebrasModel,
      sambanovaKey, sambanovaModel,
      maxMessages, maxMessagesAll
    };

    await chrome.storage.local.set(settings);

    updateRoutingStatusBadge();

    btnSaveSettings.disabled = true;
    btnSaveSettings.textContent = "Saved ✓";
    btnSaveSettings.style.background = "#16a34a";

    setTimeout(() => {
      btnSaveSettings.textContent = "Save Settings";
      btnSaveSettings.style.background = "";
      btnSaveSettings.disabled = false;
    }, 2000);
  });

  // ── HISTORY MANAGEMENT ──────────────────────────────────────────────────────
  async function saveToHistory(platform, promptText, provider, model) {
    try {
      const storage = await chrome.storage.local.get("historyList");
      let historyList = storage.historyList || [];

      const newItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "short"
        }),
        platform: platform || "AI Chat",
        provider: provider || "AI",
        model: model || "",
        prompt: promptText
      };

      historyList.unshift(newItem);
      if (historyList.length > 50) {
        historyList = historyList.slice(0, 50);
      }

      await chrome.storage.local.set({ historyList });
    } catch (err) {
      console.error("Save history error:", err);
    }
  }

  async function loadHistory() {
    try {
      const storage = await chrome.storage.local.get("historyList");
      const list = storage.historyList || [];

      renderHistoryCards(list);
    } catch (err) {
      console.error("Load history error:", err);
    }
  }

  function renderHistoryCards(items) {
    const query = (historySearch.value || "").toLowerCase().trim();

    let filtered = items;
    if (activeHistoryFilter !== "all") {
      filtered = filtered.filter(i => {
        const plat = (i.platform || "").toLowerCase();
        if (activeHistoryFilter === "other") {
          return !["claude", "chatgpt", "gemini", "deepseek"].includes(plat);
        }
        return plat.includes(activeHistoryFilter);
      });
    }

    if (query) {
      filtered = filtered.filter(i =>
        (i.prompt && i.prompt.toLowerCase().includes(query)) ||
        (i.platform && i.platform.toLowerCase().includes(query)) ||
        (i.provider && i.provider.toLowerCase().includes(query))
      );
    }

    if (filtered.length === 0) {
      historyEmpty.classList.remove("hidden");
      historyItemsContainer.classList.add("hidden");
      return;
    }

    historyEmpty.classList.add("hidden");
    historyItemsContainer.classList.remove("hidden");
    historyItemsContainer.innerHTML = "";

    filtered.forEach(item => {
      const card = document.createElement("div");
      card.className = "history-card glass";

      const previewSnippet = item.prompt.length > 100
        ? item.prompt.slice(0, 100).trim() + "..."
        : item.prompt;

      card.innerHTML = `
        <div class="history-card-header">
          <div class="history-meta">
            <span class="platform-pill ${item.platform.toLowerCase()}">
              <span>${item.platform}</span>
            </span>
            <span class="history-time">${item.timestamp}</span>
            ${item.provider ? `<span style="font-size:10px;color:var(--muted)">• ${item.provider}</span>` : ""}
          </div>
          <div class="history-actions">
            <button class="btn-micro btn-history-expand" title="Toggle full preview">View</button>
            <button class="btn-history-copy" title="Copy Prompt">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon">
                <rect x="9" y="9" width="13" height="13" rx="1.5" ry="1.5"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="btn-history-delete" title="Delete entry">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="action-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
        <div class="history-preview">${escapeHtml(previewSnippet)}</div>
        <div class="history-card-expanded scrollbar hidden">${escapeHtml(item.prompt)}</div>
      `;

      // Copy action
      card.querySelector(".btn-history-copy").addEventListener("click", () => {
        navigator.clipboard.writeText(item.prompt).then(() => {
          showToast("Copied from history!");
        });
      });

      // Expand action
      const btnExpand = card.querySelector(".btn-history-expand");
      const expandedBox = card.querySelector(".history-card-expanded");
      btnExpand.addEventListener("click", () => {
        const isHidden = expandedBox.classList.toggle("hidden");
        btnExpand.textContent = isHidden ? "View" : "Hide";
      });

      // Delete action
      card.querySelector(".btn-history-delete").addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteHistoryItem(item.id);
        loadHistory();
      });

      historyItemsContainer.appendChild(card);
    });
  }

  async function deleteHistoryItem(itemId) {
    const storage = await chrome.storage.local.get("historyList");
    let historyList = storage.historyList || [];
    historyList = historyList.filter(i => i.id !== itemId);
    await chrome.storage.local.set({ historyList });
    showToast("Deleted from history.");
  }

  // Filter chips click handler
  filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      filterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeHistoryFilter = chip.dataset.filter;
      loadHistory();
    });
  });

  // History search input handler
  historySearch.addEventListener("input", () => {
    loadHistory();
  });

  // Export History
  btnExportHistory.addEventListener("click", async () => {
    const storage = await chrome.storage.local.get("historyList");
    const list = storage.historyList || [];
    if (list.length === 0) {
      showToast("No history to export.");
      return;
    }

    let md = "# The Context — History Export\n\n";
    list.forEach((item, idx) => {
      md += `## [${idx + 1}] ${item.platform} (${item.timestamp})\n`;
      if (item.provider) md += `*Engine: ${item.provider} (${item.model || ""})*\n\n`;
      md += "```\n" + item.prompt + "\n```\n\n---\n\n";
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `the-context-history-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("History exported as Markdown!");
  });

  // Clear History
  btnClearHistory.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear all history entries?")) {
      await chrome.storage.local.set({ historyList: [] });
      loadHistory();
      showToast("All history cleared.");
    }
  });

  // ── HELPER UTILITIES ────────────────────────────────────────────────────────
  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 2200);
  }

  function showError(message) {
    const msgEl = errorBanner.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = message;
    errorBanner.classList.remove("hidden");
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Run initial scan
  performScan();
});
