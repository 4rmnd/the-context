# The Context

> **One click. Full context. Never start over.**

A Chrome extension that scans your active AI conversation (Claude, ChatGPT, or Gemini), then generates a ready-to-paste **Continuation Prompt** — so you can seamlessly resume in a new session without losing any context.

---

## Why?

When you hit a quota limit mid-session, all your hard-won context disappears. You're forced to re-explain everything from scratch.

**The Context** fixes that. In one click, it captures the full thread, sends it to an AI model to intelligently summarize it, and hands you a compact, paste-ready prompt that lets any AI pick up right where you left off.

---

## Supported Platforms

| Platform | URL |
|----------|-----|
| Claude | `claude.ai/chat/*` |
| ChatGPT | `chatgpt.com/*` |
| Gemini | `gemini.google.com/*` |

---

## Features

- 🔍 **Smart Conversation Scanner** — reads the full thread via DOM scraping with multiple fallback strategies per platform
- ✨ **AI-Powered Summarization** — generates a structured Continuation Prompt (context + last output + explicit resume instruction)
- 📋 **One-Click Copy** — copies the prompt to clipboard instantly
- 🕑 **Local History** — stores the last 10 generated prompts in your browser (never leaves your machine)
- 🔑 **Bring Your Own Key (BYOK)** — uses your own API keys; no server middleman, no data collection
- ⚡ **Cascading Fallback** — tries Gemini first, then Groq, then OpenRouter if previous fail

---

## Installation (Manual / Unpacked)

> The extension is not yet on the Chrome Web Store. Install it manually in a few steps.

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/4rmnd/the-context.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **"Load unpacked"** and select the cloned folder

5. The extension icon will appear in your Chrome toolbar

---

## Setup: Get Your API Keys

The extension uses a **BYOK (Bring Your Own Key)** model — your keys are stored locally in your browser and never sent to any server other than the API provider directly.

### Gemini API Key (Primary — Free tier available)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy it

### Groq API Key (Fallback — Free tier available)
1. Go to [Groq Console](https://console.groq.com/keys)
2. Create a new API key
3. Copy it

### OpenRouter API Key (Fallback — Free/Paid models available)
1. Go to [OpenRouter Console](https://openrouter.ai/keys)
2. Create a new API key
3. Copy it

Then open the extension popup → **Settings** tab → paste your keys and configure your model choice → **Save Settings**.

---

## How to Use

1. Open a conversation on Claude, ChatGPT, or Gemini
2. Click the **The Context** icon in your Chrome toolbar
3. Click **"Generate Continuation Prompt"**
4. Wait ~5–10 seconds for the AI to process
5. Click **"Copy Continuation Prompt"**
6. Paste it into a new session on any AI platform

---

## Project Structure

```
the-context/
├── manifest.json          # Chrome Extension Manifest V3
├── background/
│   └── background.js      # Service worker — API calls (Gemini + Groq + OpenRouter)
├── content/
│   └── content.js         # Content script — DOM scraper for all 3 platforms
└── popup/
    ├── popup.html         # Extension popup UI
    ├── popup.js           # Popup logic (tabs, scan, generate, history)
    └── popup.css          # Styling (dark mode, design tokens)
```

---

## Privacy

- **No server.** All communication goes directly from your browser to the API provider (Google, Groq, or OpenRouter).
- **No tracking.** Zero analytics, zero telemetry.
- **Local storage only.** Your API keys and prompt history are stored in `chrome.storage.local` — they never leave your browser.

---

## Roadmap

- [x] DOM scraper for Claude, ChatGPT, Gemini
- [x] Generate Continuation Prompt via Gemini, Groq, and OpenRouter
- [x] Local history (last 10 prompts)
- [x] BYOK settings with custom OpenRouter model choice
- [ ] Configurable message window (scan last N messages)
- [ ] Dark mode toggle in popup
- [ ] Support for more platforms (Perplexity, Mistral, etc.)
- [ ] Chrome Web Store release

---

## License

[MIT](./LICENSE) © 2026
