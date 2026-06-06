document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const tabs = document.querySelectorAll(".nav-btn");
  const panels = document.querySelectorAll(".tab-panel");
  
  const platformPill = document.getElementById("platform-pill");
  const platformFavicon = document.getElementById("platform-favicon");
  const platformName = document.getElementById("platform-name");
  const detectedSiteLabel = document.getElementById("detected-site-label");
  const scrapedCountLabel = document.getElementById("scraped-count-label");
  const btnGenerate = document.getElementById("btn-generate");
  const spinner = btnGenerate.querySelector(".spinner");
  const btnText = btnGenerate.querySelector(".btn-text");
  
  const resultWrapper = document.getElementById("result-wrapper");
  const providerBadge = document.getElementById("provider-badge");
  const promptOutput = document.getElementById("prompt-output");
  const btnCopy = document.getElementById("btn-copy");
  const copyIcon = btnCopy.querySelector(".copy-icon");
  const copySuccessCheck = btnCopy.querySelector(".copy-success-check");
  
  const toast = document.getElementById("toast");
  const errorBanner = document.getElementById("error-banner");
  
  const historyEmpty = document.getElementById("history-empty");
  const historyItemsContainer = document.getElementById("history-items");
  
  const settingsForm = document.getElementById("settings-form");
  const geminiKeyInput = document.getElementById("gemini-key");
  const groqKeyInput = document.getElementById("groq-key");
  const openrouterKeyInput = document.getElementById("openrouter-key");
  const openrouterModelSelect = document.getElementById("openrouter-model-select");
  const openrouterCustomModelWrapper = document.getElementById("openrouter-custom-model-wrapper");
  const openrouterModelCustomInput = document.getElementById("openrouter-model-custom");
  const maxMessagesInput = document.getElementById("max-messages");
  const maxMessagesVal = document.getElementById("max-messages-val");
  const maxMessagesAllCheckbox = document.getElementById("max-messages-all");

  let activeTabId = null;
  let scrapedRawText = "";      // Raw page text (new selector-free approach)
  let detectedPlatform = "Unknown";
  let extensionSettings = {
    geminiKey: "",
    groqKey: "",
    openrouterKey: "",
    openrouterModel: "google/gemini-2.0-flash:free",
    maxMessages: 50,
    maxMessagesAll: false
  };

  // --- TAB NAVIGATION ---
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      
      tab.classList.add("active");
      const targetPanel = document.getElementById(`tab-${tab.dataset.tab}`);
      if (targetPanel) targetPanel.classList.add("active");

      // Load history when entering history tab
      if (tab.dataset.tab === "history") {
        loadHistory();
      }
    });
  });

  // --- SETTINGS LOGIC ---
  // Load settings from storage
  const loadedSettings = await chrome.storage.local.get(["geminiKey", "groqKey", "openrouterKey", "openrouterModel", "maxMessages", "maxMessagesAll"]);
  if (loadedSettings.geminiKey) extensionSettings.geminiKey = loadedSettings.geminiKey;
  if (loadedSettings.groqKey) extensionSettings.groqKey = loadedSettings.groqKey;
  if (loadedSettings.openrouterKey) extensionSettings.openrouterKey = loadedSettings.openrouterKey;
  if (loadedSettings.openrouterModel) extensionSettings.openrouterModel = loadedSettings.openrouterModel;
  if (loadedSettings.maxMessages) extensionSettings.maxMessages = loadedSettings.maxMessages;
  if (loadedSettings.maxMessagesAll !== undefined) extensionSettings.maxMessagesAll = loadedSettings.maxMessagesAll;

  // Initialize Settings UI values
  geminiKeyInput.value = extensionSettings.geminiKey;
  groqKeyInput.value = extensionSettings.groqKey;
  openrouterKeyInput.value = extensionSettings.openrouterKey;
  
  // Set up OpenRouter model selection UI
  const predefinedModels = [
    "google/gemini-2.0-flash:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash",
    "meta-llama/llama-3.3-70b-instruct",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.5-haiku",
    "deepseek/deepseek-chat",
    "mistralai/mistral-large",
    "openrouter/auto"
  ];
  
  const currentModel = extensionSettings.openrouterModel || "google/gemini-2.0-flash:free";
  if (predefinedModels.includes(currentModel)) {
    openrouterModelSelect.value = currentModel;
    openrouterCustomModelWrapper.classList.add("hidden");
    openrouterModelCustomInput.value = "";
  } else {
    openrouterModelSelect.value = "custom";
    openrouterCustomModelWrapper.classList.remove("hidden");
    openrouterModelCustomInput.value = currentModel;
  }
  
  maxMessagesInput.value = extensionSettings.maxMessages;
  maxMessagesVal.textContent = extensionSettings.maxMessagesAll ? "All" : extensionSettings.maxMessages;
  maxMessagesAllCheckbox.checked = extensionSettings.maxMessagesAll;
  // If All is checked, dim the slider
  if (extensionSettings.maxMessagesAll) {
    maxMessagesInput.disabled = true;
    maxMessagesInput.style.opacity = "0.4";
  }

  // Visibility toggle button for passwords
  document.querySelectorAll(".btn-toggle-visibility").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (targetInput.type === "password") {
        targetInput.type = "text";
        btn.textContent = "🙈";
      } else {
        targetInput.type = "password";
        btn.textContent = "👁️";
      }
    });
  });

  // Slider change handler
  maxMessagesInput.addEventListener("input", (e) => {
    if (!maxMessagesAllCheckbox.checked) {
      maxMessagesVal.textContent = e.target.value;
    }
  });

  // "All messages" checkbox
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

  // OpenRouter model dropdown change handler
  openrouterModelSelect.addEventListener("change", () => {
    if (openrouterModelSelect.value === "custom") {
      openrouterCustomModelWrapper.classList.remove("hidden");
      openrouterModelCustomInput.focus();
    } else {
      openrouterCustomModelWrapper.classList.add("hidden");
    }
  });

  // Save Settings
  const btnSaveSettings = document.getElementById("btn-save-settings");

  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const geminiKey = geminiKeyInput.value.trim();
    const groqKey = groqKeyInput.value.trim();
    const openrouterKey = openrouterKeyInput.value.trim();
    
    let openrouterModel = openrouterModelSelect.value;
    if (openrouterModel === "custom") {
      openrouterModel = openrouterModelCustomInput.value.trim();
    }
    if (!openrouterModel) {
      openrouterModel = "google/gemini-2.0-flash:free";
    }
    
    const maxMessages = parseInt(maxMessagesInput.value, 10);
    const maxMessagesAll = maxMessagesAllCheckbox.checked;

    extensionSettings = { geminiKey, groqKey, openrouterKey, openrouterModel, maxMessages, maxMessagesAll };
    
    await chrome.storage.local.set(extensionSettings);

    // Visual feedback directly on the button
    btnSaveSettings.disabled = true;
    btnSaveSettings.textContent = "Saved ✓";
    btnSaveSettings.style.background = "#16a34a";
    btnSaveSettings.style.color = "#fff";

    setTimeout(() => {
      btnSaveSettings.textContent = "Save Settings";
      btnSaveSettings.style.background = "";
      btnSaveSettings.style.color = "";
      btnSaveSettings.disabled = false;
    }, 2000);
  });

  // --- AUTOSCAN LOGIC ---
  async function performScan() {
    try {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabs.length === 0) return;
      
      const activeTab = activeTabs[0];
      activeTabId = activeTab.id;
      const url = activeTab.url || "";
      const tabFavicon = activeTab.favIconUrl || "";

      let platform = "Unknown";
      if (url.includes("claude.ai")) platform = "Claude";
      else if (url.includes("chatgpt.com")) platform = "ChatGPT";
      else if (url.includes("gemini.google.com")) platform = "Gemini";

      detectedPlatform = platform;
      updatePlatformUI(platform, tabFavicon);

      if (platform === "Unknown") {
        detectedSiteLabel.textContent = "This tab is not a supported AI chat";
        scrapedCountLabel.textContent = "-";
        btnGenerate.disabled = true;
        return;
      }

      detectedSiteLabel.textContent = `${platform} Chat`;
      scrapedCountLabel.textContent = "Scanning all messages...";

      // Send scan message to content script
      chrome.tabs.sendMessage(activeTabId, { action: "scan_chat" }, (response) => {
        // Handle runtime error (e.g. content script not loaded yet)
        if (chrome.runtime.lastError) {
          console.warn("Scan failed, content script not ready. Attempting manual injection...", chrome.runtime.lastError);
          attemptScriptInjection(activeTabId);
          return;
        }

        handleScanResponse(response);
      });
    } catch (err) {
      console.error("Autoscan error:", err);
      scrapedCountLabel.textContent = "Scan failed";
    }
  }

  // Inject content script manually if page was open before extension install/reload
  async function attemptScriptInjection(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content/content.js"]
      });
      
      // Retry scan after brief delay
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: "scan_chat" }, (response) => {
          if (chrome.runtime.lastError) {
            scrapedCountLabel.textContent = "Refresh this page";
            showError("Failed to inject script. Please refresh the AI chat page first.");
            return;
          }
          handleScanResponse(response);
        });
      }, 300);
    } catch (err) {
      console.error("Injection failed:", err);
      scrapedCountLabel.textContent = "Refresh page";
      showError("Extension not ready on this tab. Please refresh the page.");
    }
  }

  function handleScanResponse(response) {
    if (response && response.success && response.rawText) {
      scrapedRawText = response.rawText;
      const count = response.messageCount || "?";
      scrapedCountLabel.textContent = `~${count} messages detected`;
      btnGenerate.disabled = false;
      errorBanner.classList.add("hidden");
    } else {
      scrapedRawText = "";
      scrapedCountLabel.textContent = "0 content detected";
      btnGenerate.disabled = true;
      showError(response?.error || "Failed to scan conversation.");
    }
  }

  // Local PNG files from icons folder
  const PLATFORM_ICONS = {
    Claude:  "../icons/claude.png",
    ChatGPT: "../icons/chatgpt.png",
    Gemini:  "../icons/gemini.png"
  };

  // tabFavicon = activeTab.favIconUrl (Chrome cache), falls back to bundled SVG
  function updatePlatformUI(platform, tabFavicon) {
    platformPill.className = "platform-pill " + platform.toLowerCase();
    const label = platform === "Unknown" ? "Unsupported" : platform;
    platformName.textContent = label;

    const faviconUrl = PLATFORM_ICONS[platform];
    if (faviconUrl) {
      platformFavicon.src = faviconUrl;
      platformFavicon.classList.remove("hidden");
    } else {
      platformFavicon.src = "";
      platformFavicon.classList.add("hidden");
    }
  }

  // Run initial scan on startup
  performScan();

  // --- GENERATE CONTINUATION PROMPT ---
  btnGenerate.addEventListener("click", () => {
    if (!scrapedRawText) return;

    // Toggle loading UI
    btnGenerate.disabled = true;
    spinner.classList.remove("hidden");
    btnText.textContent = "Generating...";
    resultWrapper.classList.add("hidden");
    errorBanner.classList.add("hidden");

    // Send raw text + platform to background service worker
    // If maxMessagesAll is set, pass 0 (= unlimited) to background
    const effectiveMaxMessages = extensionSettings.maxMessagesAll ? 0 : extensionSettings.maxMessages;
    chrome.runtime.sendMessage({
      action: "generate_prompt",
      rawText: scrapedRawText,
      platform: detectedPlatform,
      maxMessages: effectiveMaxMessages
    }, (response) => {
      // Toggle back loading UI
      btnGenerate.disabled = false;
      spinner.classList.add("hidden");
      btnText.textContent = "Generate Continuation Prompt";

      if (chrome.runtime.lastError) {
        showError("Background Worker Error: " + chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        promptOutput.value = response.prompt;
        providerBadge.textContent = response.providerUsed;
        resultWrapper.classList.remove("hidden");
        saveToHistory(detectedPlatform, response.prompt);
      } else {
        showError(response?.error || "Failed to generate Continuation Prompt.");
      }
    });
  });

  // --- COPY TO CLIPBOARD ---
  btnCopy.addEventListener("click", () => {
    const text = promptOutput.value;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      // Show success micro-interaction
      copyIcon.classList.add("hidden");
      copySuccessCheck.classList.remove("hidden");
      
      showToast("Copied to clipboard!");
      
      setTimeout(() => {
        copyIcon.classList.remove("hidden");
        copySuccessCheck.classList.add("hidden");
      }, 2000);
    }).catch(err => {
      showError("Failed to copy to clipboard: " + err.message);
    });
  });

  // --- HISTORY PERSISTENCE & ACTIONS ---
  async function saveToHistory(platform, promptText) {
    try {
      const storage = await chrome.storage.local.get("historyList");
      let historyList = storage.historyList || [];

      // Create new history item
      const newItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString("en-US", { 
          hour: "2-digit", 
          minute: "2-digit",
          day: "2-digit",
          month: "short"
        }),
        platform: platform,
        prompt: promptText
      };

      // Add to beginning of history list
      historyList.unshift(newItem);

      // Enforce limit of 10 items
      if (historyList.length > 10) {
        historyList = historyList.slice(0, 10);
      }

      await chrome.storage.local.set({ historyList });
    } catch (err) {
      console.error("Save history error:", err);
    }
  }

  async function loadHistory() {
    try {
      const storage = await chrome.storage.local.get("historyList");
      const historyList = storage.historyList || [];

      if (historyList.length === 0) {
        historyEmpty.classList.remove("hidden");
        historyItemsContainer.classList.add("hidden");
        return;
      }

      historyEmpty.classList.add("hidden");
      historyItemsContainer.classList.remove("hidden");
      historyItemsContainer.innerHTML = ""; // Clear existing

      historyList.forEach(item => {
        const card = document.createElement("div");
        card.className = "history-card glass";
        
        // Truncate prompt text preview
        const preview = item.prompt.length > 70 ? item.prompt.substring(0, 70) + "..." : item.prompt;
        
        card.innerHTML = `
          <div class="history-card-header">
            <div class="history-meta">
              <span class="platform-pill ${item.platform.toLowerCase()}">
                <img src="../icons/${item.platform.toLowerCase()}.png" class="platform-favicon" alt="" aria-hidden="true">
                <span>${item.platform}</span>
              </span>
              <span class="history-time">${item.timestamp}</span>
            </div>
            <div class="history-actions">
              <button class="btn-history-copy" data-id="${item.id}" title="Copy Prompt">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon">
                  <rect x="9" y="9" width="13" height="13" rx="1.5" ry="1.5"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button class="btn-history-delete" data-id="${item.id}" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="action-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
          <div class="history-preview">${escapeHtml(preview)}</div>
        `;
        
        // Add Copy handler to the card's button
        card.querySelector(".btn-history-copy").addEventListener("click", () => {
          navigator.clipboard.writeText(item.prompt).then(() => {
            showToast("Copied from history!");
          });
        });

        // Add Delete handler to the card's button
        card.querySelector(".btn-history-delete").addEventListener("click", async (e) => {
          e.stopPropagation();
          await deleteHistoryItem(item.id);
          loadHistory(); // Reload view
        });

        historyItemsContainer.appendChild(card);
      });
    } catch (err) {
      console.error("Load history error:", err);
    }
  }

  async function deleteHistoryItem(itemId) {
    try {
      const storage = await chrome.storage.local.get("historyList");
      let historyList = storage.historyList || [];
      historyList = historyList.filter(item => item.id !== itemId);
      await chrome.storage.local.set({ historyList });
      showToast("Entry deleted.");
    } catch (err) {
      console.error("Delete history error:", err);
    }
  }

  // --- TOAST AND ERROR HELPER ---
  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    
    // Automatically hide after 2 seconds
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 2000);
  }

  function showError(message) {
    const msgEl = errorBanner.querySelector(".error-msg");
    if (msgEl) {
      msgEl.textContent = message;
    } else {
      errorBanner.textContent = message;
    }
    errorBanner.classList.remove("hidden");
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
