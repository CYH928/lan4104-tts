// ── Voices ──
const VOICES = {
  "en-US": [
    { id: "en-US-JennyNeural", name: "Jenny (F)" },
    { id: "en-US-GuyNeural", name: "Guy (M)" },
    { id: "en-US-AriaNeural", name: "Aria (F)" },
    { id: "en-US-DavisNeural", name: "Davis (M)" },
  ],
  "en-GB": [
    { id: "en-GB-SoniaNeural", name: "Sonia (F)" },
    { id: "en-GB-RyanNeural", name: "Ryan (M)" },
  ],
  "zh-HK": [
    { id: "zh-HK-HiuMaanNeural", name: "曉曼 (女)" },
    { id: "zh-HK-HiuGaaiNeural", name: "曉佳 (女)" },
    { id: "zh-HK-WanLungNeural", name: "雲龍 (男)" },
  ],
  "zh-CN": [
    { id: "zh-CN-XiaoxiaoNeural", name: "曉曉 (女)" },
    { id: "zh-CN-YunxiNeural", name: "雲希 (男)" },
    { id: "zh-CN-YunjianNeural", name: "雲健 (男)" },
    { id: "zh-CN-XiaoyiNeural", name: "曉伊 (女)" },
  ],
  "zh-TW": [
    { id: "zh-TW-HsiaoChenNeural", name: "曉臻 (女)" },
    { id: "zh-TW-YunJheNeural", name: "雲哲 (男)" },
    { id: "zh-TW-HsiaoYuNeural", name: "曉雨 (女)" },
  ],
  "ja-JP": [
    { id: "ja-JP-NanamiNeural", name: "七海 (女)" },
    { id: "ja-JP-KeitaNeural", name: "圭太 (男)" },
  ],
  "ko-KR": [
    { id: "ko-KR-SunHiNeural", name: "선희 (여)" },
    { id: "ko-KR-InJoonNeural", name: "인준 (남)" },
  ],
};

// ── i18n ──
const I18N = {
  en: {
    subtitle: "High-quality Text-to-Speech",
    language: "Language",
    voice: "Voice",
    speed: "Speed",
    text: "Text",
    placeholder: "Type or paste your text here...",
    play: "Play",
    generating: "Generating...",
    generatingN: "Generating {c}/{t}...",
    shortcut: "Ctrl+Enter to play",
    footer: "Powered by Edge TTS \u00B7 Hosted on Cloudflare",
    errorEmpty: "Please enter some text",
    errorFailed: "Speech synthesis failed",
    words: "words",
    langToggleLabel: "繁中",
  },
  "zh-Hant": {
    subtitle: "高音質文字轉語音",
    language: "語言",
    voice: "語音",
    speed: "語速",
    text: "文字內容",
    placeholder: "請輸入要轉換嘅文字...",
    play: "播放",
    generating: "生成中...",
    generatingN: "生成中 {c}/{t}...",
    shortcut: "Ctrl+Enter 快速播放",
    footer: "由 Edge TTS 驅動 \u00B7 託管於 Cloudflare",
    errorEmpty: "請輸入文字",
    errorFailed: "語音合成失敗",
    words: "字",
    langToggleLabel: "EN",
  },
};

const MAX_CHARS = 100000;
const CHUNK_SIZE = 4000;

// ── DOM ──
const $ = (id) => document.getElementById(id);
const langEl = $("language");
const voiceEl = $("voice");
const textEl = $("text");
const rateEl = $("rate");
const rateValueEl = $("rateValue");
const rateResetBtn = $("rateReset");
const charCountEl = $("charCount");
const wordCountEl = $("wordCount");
const playBtn = $("playBtn");
const playIcon = $("playIcon");
const loadingIcon = $("loadingIcon");
const playText = $("playText");
const downloadBtn = $("downloadBtn");
const playerWrap = $("playerWrap");
const audioEl = $("audio");
const errorEl = $("error");
const errorText = $("errorText");
const themeToggle = $("themeToggle");
const langToggle = $("langToggle");
const zoomInBtn = $("zoomIn");
const zoomOutBtn = $("zoomOut");
const zoomLevelEl = $("zoomLevel");

let currentBlobUrl = null;
let errorTimeout = null;
let uiLang = localStorage.getItem("uiLang") || "en";

// ── i18n helpers ──
function t(key) {
  return (I18N[uiLang] || I18N.en)[key] || (I18N.en)[key] || key;
}

function applyI18n() {
  $("subtitle").textContent = t("subtitle");
  $("labelLang").textContent = t("language");
  $("labelVoice").textContent = t("voice");
  $("labelSpeed").textContent = t("speed");
  $("labelText").textContent = t("text");
  textEl.placeholder = t("placeholder");
  if (!playBtn.disabled) playText.textContent = t("play");
  $("shortcutHint").textContent = t("shortcut");
  $("wordLabel").textContent = " " + t("words");
  $("footerInfo").textContent = t("footer");
  langToggle.textContent = t("langToggleLabel");
}

// ── Theme ──
function applyTheme() {
  const stored = localStorage.getItem("theme");
  const isDark = stored === "dark" || (!stored && matchMedia("(prefers-color-scheme:dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

// ── UI Lang toggle ──
langToggle.addEventListener("click", () => {
  uiLang = uiLang === "en" ? "zh-Hant" : "en";
  localStorage.setItem("uiLang", uiLang);
  applyI18n();
});

// ── Voice list ──
function updateVoices() {
  const voices = VOICES[langEl.value] || [];
  voiceEl.length = 0;
  voices.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.name;
    voiceEl.appendChild(opt);
  });
}

// ── Range slider ──
function formatRate(val) {
  return `${(1 + val / 100).toFixed(1)}x`;
}

function updateRangeProgress() {
  const min = parseInt(rateEl.min);
  const max = parseInt(rateEl.max);
  const val = parseInt(rateEl.value);
  rateEl.style.setProperty("--range-progress", `${((val - min) / (max - min)) * 100}%`);
}

rateEl.addEventListener("input", () => {
  rateValueEl.textContent = formatRate(parseInt(rateEl.value));
  updateRangeProgress();
});

rateResetBtn.addEventListener("click", () => {
  rateEl.value = 0;
  rateValueEl.textContent = "1.0x";
  updateRangeProgress();
});

rateEl.addEventListener("dblclick", () => {
  rateEl.value = 0;
  rateValueEl.textContent = "1.0x";
  updateRangeProgress();
});

// ── Word & char count ──
function countWords(str) {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  // Count CJK characters individually + latin/other word runs
  const cjk = trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g);
  const latin = trimmed.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, " ").match(/\S+/g);
  return (cjk ? cjk.length : 0) + (latin ? latin.length : 0);
}

function updateCharCount() {
  const len = textEl.value.length;
  charCountEl.textContent = len.toLocaleString();
  wordCountEl.textContent = countWords(textEl.value).toLocaleString();
  if (len > MAX_CHARS * 0.9) {
    charCountEl.className = "text-red-500 font-medium";
  } else if (len > MAX_CHARS * 0.7) {
    charCountEl.className = "text-amber-500";
  } else {
    charCountEl.className = "text-slate-400";
  }
}

textEl.addEventListener("input", updateCharCount);

// ── Error toast ──
function showError(msg) {
  if (errorTimeout) clearTimeout(errorTimeout);
  errorText.textContent = msg;
  errorEl.classList.remove("hidden", "toast-out");
  errorEl.classList.add("toast-in");
  errorTimeout = setTimeout(() => {
    errorEl.classList.add("toast-out");
    setTimeout(() => errorEl.classList.add("hidden"), 300);
  }, 4000);
}

// ── Loading state ──
function setLoading(loading, current, total) {
  playBtn.disabled = loading;
  downloadBtn.disabled = loading;
  playIcon.classList.toggle("hidden", loading);
  loadingIcon.classList.toggle("hidden", !loading);
  if (!loading) {
    playText.textContent = t("play");
  } else if (total && total > 1) {
    playText.textContent = t("generatingN").replace("{c}", current).replace("{t}", total);
  } else {
    playText.textContent = t("generating");
  }
}

function cleanupBlob() {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
}

// ── Text chunking ──
function splitIntoChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  let buf = "";

  for (const para of paragraphs) {
    if (buf.length + para.length + 2 <= maxLen) {
      buf += (buf ? "\n\n" : "") + para;
    } else {
      if (buf) chunks.push(buf);

      if (para.length <= maxLen) {
        buf = para;
      } else {
        // Split long paragraph by sentences
        const sentences = para.match(/[^.!?\n。！？]+[.!?\n。！？]*/g) || [para];
        buf = "";
        for (const s of sentences) {
          if (buf.length + s.length <= maxLen) {
            buf += s;
          } else {
            if (buf) chunks.push(buf);
            if (s.length > maxLen) {
              // Hard split
              for (let i = 0; i < s.length; i += maxLen) {
                chunks.push(s.slice(i, i + maxLen));
              }
              buf = "";
            } else {
              buf = s;
            }
          }
        }
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// ── Synthesis ──
async function synthesize() {
  const text = textEl.value.trim();
  if (!text) {
    showError(t("errorEmpty"));
    return null;
  }

  const rate = parseInt(rateEl.value);
  const rateStr = rate >= 0 ? `+${rate}%` : `${rate}%`;
  const voice = voiceEl.value;
  const chunks = splitIntoChunks(text, CHUNK_SIZE);
  const blobs = [];

  for (let i = 0; i < chunks.length; i++) {
    setLoading(true, i + 1, chunks.length);

    const payload = JSON.stringify({ text: chunks[i], voice, rate: rateStr });
    let resp;
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (resp.ok || resp.status < 500) break;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }

    if (!resp.ok) {
      let msg = t("errorFailed");
      try {
        const err = await resp.json();
        msg = err.error || msg;
      } catch {}
      throw new Error(msg);
    }

    blobs.push(await resp.blob());
  }

  return new Blob(blobs, { type: "audio/mpeg" });
}

// ── Events ──
langEl.addEventListener("change", updateVoices);

playBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    const blob = await synthesize();
    if (blob) {
      cleanupBlob();
      currentBlobUrl = URL.createObjectURL(blob);
      audioEl.src = currentBlobUrl;
      playerWrap.classList.remove("hidden");
      audioEl.play();
    }
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

downloadBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    const blob = await synthesize();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tts-audio.mp3";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

textEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    playBtn.click();
  }
});

// ── Text zoom ──
const ZOOM_MIN = 12;
const ZOOM_MAX = 28;
const ZOOM_STEP = 2;
let fontSize = parseInt(localStorage.getItem("fontSize")) || 14;

function applyZoom() {
  textEl.style.fontSize = `${fontSize}px`;
  zoomLevelEl.textContent = `${fontSize}px`;
}

zoomInBtn.addEventListener("click", () => {
  if (fontSize < ZOOM_MAX) {
    fontSize += ZOOM_STEP;
    localStorage.setItem("fontSize", fontSize);
    applyZoom();
  }
});

zoomOutBtn.addEventListener("click", () => {
  if (fontSize > ZOOM_MIN) {
    fontSize -= ZOOM_STEP;
    localStorage.setItem("fontSize", fontSize);
    applyZoom();
  }
});

// ── Init ──
applyTheme();
applyI18n();
updateVoices();
updateRangeProgress();
textEl.setAttribute("maxlength", MAX_CHARS);
applyZoom();
