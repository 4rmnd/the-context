# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-06-05

### Added
- Integrated **OpenRouter** as the third cascading API fallback provider (Gemini → Groq → OpenRouter).
- Added settings panel inputs in popup for OpenRouter API Key (with visibility toggle).
- Added dropdown selection for popular OpenRouter models (Gemini 2.0 Flash, Llama 3.3 70B, Claude 3.5 Sonnet, DeepSeek Chat, etc.) and a custom model input field.
- Updated manifest permissions and CSP headers to allow requests to `https://openrouter.ai`.

## [1.0.0] — 2026-06-04

### Added
- DOM scraper for **Claude.ai** with 4 fallback selector patterns
- DOM scraper for **ChatGPT** using stable `data-message-author-role` attribute
- DOM scraper for **Gemini** using custom web components (`user-query`, `model-response`)
- Raw page text fallback (Phase 2) for resilience against DOM changes
- AI-powered **Continuation Prompt** generation via Gemini 2.0 Flash (primary)
- **Groq** (llama-3.3-70b-versatile) as automatic fallback provider
- Cascading fallback logic: Gemini → Groq → descriptive error with setup links
- **BYOK (Bring Your Own Key)** settings UI — keys stored in `chrome.storage.local` only
- Local **History** panel — stores last 10 generated prompts
- History item copy and delete actions
- Platform detection pill (Claude / ChatGPT / Gemini / Unsupported)
- Configurable message window via slider (10–60 messages)
- Manual script injection fallback for tabs opened before extension install
- Dark mode UI with Vercel-inspired design tokens
- Toast notification on clipboard copy
- Error banner with actionable error messages
