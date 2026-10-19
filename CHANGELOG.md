# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] — 2026-10-19

### Added
- **Context Carry Header Architecture (PRD v1.0)**:
  - Re-architected `SYSTEM_PROMPT` to generate a standardized 8-section header (`QUICK BRIEF`, `ACTIVE CONSTRAINTS & RULES`, `DECISIONS`, `OPEN ITEMS`, `ARTIFACTS & REFERENCES`, `STATUS & LAST CHECKPOINT`, `CONTINUATION DIRECTIVE`).
  - **Fixed Opening Directive (FR-12)**: Standardized directive block instructing the receiving AI to treat the payload as background context, avoid summarizing it back, resume directly from checkpoint, and clarify ambiguities.
  - **Ownership Tagging (FR-10)**: Clear attribution tags `[USER]` (decisions/constraints explicitly made or approved by user) and `[USULAN AI]` (unconfirmed AI suggestions).
  - **Superseded History Tracking (FR-11)**: Explicit tracking of evolved decisions/rules via `(digantikan: <old> → <new>)` format to prevent receiving AI from assuming superseded choices are active.
  - **Artifacts & References Verbatim Extraction (FR-7)**: Precision extraction of file paths, functions, URLs, versions, commands, and critical numbers character-for-character.
  - **Coverage Note Logic (FR-13)**: Conditional detection of truncation markers (`...[middle section omitted...]...` / `earlier messages omitted`) to alert receiving AI when the middle section was omitted.
  - **Prompt Injection Defense (FR-15)**: Scraped conversation strictly isolated as passive, untrusted data; AI header generator explicitly ignores prompt injection commands in transcript.
  - **Canonical Dummy Example (NFR-2)**: Neutral sourdough baking example included in prompt to guarantee structural compliance across smaller models (Groq/Llama) without domain contamination.

### Changed
- **Token Output Limit Bump (NFR-1)**: Increased output ceiling from 1,024 to 4,096 tokens across all 10 provider integrations (Gemini, Groq, DeepSeek, OpenRouter, OpenAI, NVIDIA NIM, Ollama, Mistral, Cerebras, SambaNova) to ensure long headers (~700–800 words) never truncate.

---

## [1.2.0] — 2026-10-05

### Added
- **Multi-Platform Scraping Expansion**: Added scrapers for 7 additional AI chat platforms:
  - DeepSeek Chat (`chat.deepseek.com`)
  - Perplexity AI (`perplexity.ai`, `www.perplexity.ai`)
  - Mistral Chat (`chat.mistral.ai`)
  - Microsoft Copilot (`copilot.microsoft.com`)
  - Grok (`grok.com`, `x.com/i/grok*`)
  - Poe (`poe.com`)
  - HuggingChat (`huggingface.co/chat`)
  - Universal DOM Scraper with heuristic role detection for unlisted conversational platforms.
- **7 New AI Backend Providers**:
  - DeepSeek API (`api.deepseek.com`)
  - OpenAI (`gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`, etc.)
  - NVIDIA NIM (`integrate.api.nvidia.com`)
  - Ollama (Local LLM via `http://localhost:11434` for 100% offline, zero-data-leak summarization)
  - Mistral AI (`api.mistral.ai`)
  - Cerebras Inference (`api.cerebras.ai`)
  - SambaNova Cloud (`api.sambanova.ai`)
- **Advanced Execution & Routing Strategies**:
  - **Cascade Fallback**: Automatic sequential failover when quota limits (HTTP 429) or server errors occur.
  - **Round-Robin Rotation**: Load-balances requests evenly across configured providers to preserve rate limits.
  - **Fusion Mode**: Multi-model consensus and synthesis pipeline with automated verification.
- **Dynamic Model Discovery & Verification**:
  - Provider-specific live model discovery to fetch real-time available models.
  - Instant Model Verification ping to test credentials, latency, and access before generating.
- **Enhanced History Suite**:
  - Instant search filter for past prompts.
  - Platform filter chips (`All`, `Claude`, `ChatGPT`, `Gemini`, `DeepSeek`, `Other`).
  - Markdown Export to download prompt history directly as a `.md` archive.
  - Expandable / collapsible prompt preview cards with single-click copy and deletion.
- **Configurable Message Window**:
  - Precision slider and presets to select conversation depth (10 to 60 messages, or full transcript).

### Changed
- **Architectural Prompt Redesign**: Generates a standardized, high-density **Session Header** (Quick Brief, Active Constraints & Rules, Status & Last Checkpoint, Continuation Directive) followed by the verbatim transcript for zero context loss.
- **Refined UI & Aesthetics**: Dark mode interface built with Vercel/Linear design tokens, glassmorphism, dynamic routing pipeline diagram, and smooth micro-interactions.
- **Updated Manifest Permissions & CSP**: Configured granular host permissions and strict CSP rules for seamless direct communication with all 10 AI APIs.

### Fixed & Improved
- Fixed virtualized scroll issues on long conversations in Claude and ChatGPT by optimizing DOM node traversal.
- Enhanced API key management with password masking, individual visibility toggles, and instant status indicators.
- Added comprehensive error banners with actionable guidance when quotas are exhausted or networks fail.

### Security
- Strict client-only security: API keys and conversation data are stored strictly in `chrome.storage.local` and transmitted directly to the respective API endpoints without any proxy or intermediary server.
- Reinforced repository `.gitignore` to block all `.env`, certificates, tokens, and local scratch files.

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
