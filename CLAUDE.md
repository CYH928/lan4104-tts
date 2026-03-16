# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` — starts Wrangler Pages dev at `http://localhost:8788`
- **Deploy:** `npm run deploy` — deploys to Cloudflare Pages via `npx wrangler pages deploy public`
- **Install:** `npm install` — only dev dependency is `wrangler`

No build step. No test framework. TailwindCSS is loaded via CDN.

## Architecture

This is a zero-cost TTS web app using Microsoft Edge TTS neural voices, hosted entirely on Cloudflare Pages (free tier).

**Data flow:**
```
Browser → POST /api/tts (JSON) → Cloudflare Worker → WSS → Microsoft Edge TTS
Browser ← audio/mpeg           ← Cloudflare Worker ← audio chunks ←
```

The Worker (`functions/api/tts.js`) is a WebSocket proxy: it opens a WSS connection to `speech.platform.bing.com`, sends SSML, collects binary audio chunks, and returns concatenated MP3. Authentication uses a DRM token (`Sec-MS-GEC`) generated from a SHA-256 hash of the current 5-minute-rounded Windows FILETIME + a static trusted client token. **BigInt is required** for the tick calculation — JavaScript `Number` overflows.

The frontend (`public/js/app.js`) handles text chunking for long inputs: splits at paragraph/sentence boundaries (max 4000 chars/chunk), makes sequential API calls, and concatenates the MP3 blobs client-side.

## Key Constants

In `functions/api/tts.js`:
- `TRUSTED_CLIENT_TOKEN` — static auth token (public, from Edge browser)
- `CHROMIUM_FULL_VERSION` — must match current Edge version used by the `edge-tts` Python library; update when Microsoft rotates
- `SEC_MS_GEC_VERSION` — derived from Chromium version
- `WIN_EPOCH = 11644473600n` — Unix-to-Windows epoch offset (BigInt)

In `public/js/app.js`:
- `VOICES` — hardcoded voice list per language
- `MAX_CHARS = 100000` — frontend character limit
- `CHUNK_SIZE = 4000` — chars per API request
- `I18N` — UI strings for `en` and `zh-Hant`

## Conventions

- Pure vanilla JS frontend — no framework, no bundler
- TailwindCSS via CDN with `darkMode: 'class'`
- Dark mode flash prevention: inline `<script>` in `<head>` applies `.dark` before render
- User preferences stored in `localStorage`: `theme`, `uiLang`, `fontSize`
- Voice name validation via regex (`VOICE_PATTERN`) to prevent SSML injection
- All error messages support i18n (backend returns English; frontend can override)
- Indent: 2 spaces, LF line endings, UTF-8 (see `.editorconfig`)

## Edge TTS Protocol

If the TTS stops working (403 errors), the likely cause is Microsoft updating the Chromium version check. Fix by:
1. Check the latest `edge-tts` Python package (`pip install -U edge-tts`)
2. Read `edge_tts/constants.py` for the new `CHROMIUM_FULL_VERSION`
3. Update the constant in `functions/api/tts.js`
