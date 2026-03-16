# TTS tiny project

A free, high-quality Text-to-Speech web app for students. Powered by Microsoft Edge TTS neural voices and hosted on Cloudflare — zero cost to deploy and run.

## Features

- **High-quality neural voices** — Microsoft Edge TTS with 300+ natural-sounding voices
- **Multi-language** — English, Cantonese, Mandarin, Taiwanese, Japanese, Korean
- **Long text support** — Up to 100,000 characters with automatic chunking
- **Speed control** — 0.5x to 3.0x playback speed
- **Play & Download** — Stream audio or download as MP3
- **Dark mode** — Auto-detects system preference, manual toggle
- **UI language** — Switch between English and 繁體中文
- **Text zoom** — Adjustable font size (12px–28px)
- **Responsive** — Works on mobile, tablet, and desktop
- **Keyboard shortcut** — Ctrl+Enter to play

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| TTS Engine | [Edge TTS](https://github.com/rany2/edge-tts) (Microsoft Neural Voices) | Free |
| Backend | Cloudflare Pages Functions (Workers) | Free (100k req/day) |
| Frontend | HTML + [TailwindCSS](https://tailwindcss.com) CDN + Vanilla JS | Free |
| Hosting | Cloudflare Pages | Free |

## Architecture

```
Browser  ──POST /api/tts──▶  Cloudflare Worker  ──WSS──▶  Microsoft Edge TTS
         ◀──audio/mpeg────                      ◀─audio──
```

The Worker acts as a WebSocket proxy — it connects to Microsoft's Edge TTS service, sends SSML, collects audio chunks, and returns an MP3 response. No API key required.

## Project Structure

```
├── public/                   Static assets (Cloudflare Pages)
│   ├── index.html            Main page (TailwindCSS)
│   ├── js/app.js             Frontend logic + i18n
│   └── _headers              Security headers
├── functions/api/tts.js      Edge TTS Worker proxy
├── wrangler.toml             Cloudflare config
├── .editorconfig             Editor config
└── package.json              Dev scripts
```

## Getting Started

### Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:8788`.

### Deploy to Cloudflare Pages

**Option A — GitHub (recommended):**

1. Push to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Pages
3. Connect your GitHub repo
4. Set build output directory to `public` (leave build command empty)
5. Deploy

Every `git push` triggers auto-deploy.

**Option B — CLI:**

```bash
npx wrangler pages deploy public
```

## Free Tier Limits

| Service | Free Quota | 120 Students? |
|---------|-----------|---------------|
| Cloudflare Pages | Unlimited static requests | More than enough |
| Cloudflare Functions | 100,000 req/day | ~833 per student/day |
| Edge TTS | No official limit | No issues with normal use |

## License

ISC

---

Made by YKHN C.
