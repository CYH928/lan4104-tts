// Edge TTS WebSocket proxy for Cloudflare Workers
// Implements the Edge TTS protocol with Sec-MS-GEC DRM token

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = "143";
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600n;
const WSS_BASE =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

const VOICE_PATTERN = /^[a-z]{2,3}-[A-Z]{2}-\w+Neural$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// --- DRM ---

async function generateSecMsGec() {
  let ticks = BigInt(Math.floor(Date.now() / 1000)) + WIN_EPOCH;
  ticks -= ticks % 300n;
  ticks *= 10000000n;
  const str = `${ticks}${TRUSTED_CLIENT_TOKEN}`;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function generateMuid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function uuid() {
  return crypto.randomUUID().replaceAll("-", "");
}

// --- Helpers ---

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function errorJson(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// --- Handlers ---

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const {
      text,
      voice = "zh-HK-HiuMaanNeural",
      rate = "+0%",
      pitch = "+0Hz",
      volume = "+0%",
    } = body;

    if (!text || !text.trim()) return errorJson("Please enter some text");
    if (text.length > 5000) return errorJson("Text must be under 5,000 characters per request");
    if (!VOICE_PATTERN.test(voice)) return errorJson("Invalid voice selection");

    const connectionId = uuid();
    const requestId = uuid();
    const secMsGec = await generateSecMsGec();
    const muid = generateMuid();
    const ts = new Date().toISOString();
    const outputFormat = "audio-24khz-48kbitrate-mono-mp3";

    // Build WebSocket URL
    const wsUrl =
      `${WSS_BASE}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
      `&ConnectionId=${connectionId}` +
      `&Sec-MS-GEC=${secMsGec}` +
      `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    // Connect via Cloudflare Workers WebSocket API
    const wsResp = await fetch(wsUrl.replace("wss://", "https://"), {
      headers: {
        Upgrade: "websocket",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: `muid=${muid};`,
      },
    });

    const ws = wsResp.webSocket;
    if (!ws) return errorJson("Failed to connect to TTS service", 502);
    ws.accept();

    // Collect audio
    const audioChunks = [];
    const done = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("TTS request timed out"));
      }, 30000);

      ws.addEventListener("message", (evt) => {
        if (typeof evt.data === "string") {
          if (evt.data.includes("Path:turn.end")) {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        } else if (evt.data instanceof ArrayBuffer) {
          const buf = evt.data;
          if (buf.byteLength > 2) {
            const view = new DataView(buf);
            const headerLen = view.getUint16(0);
            if (buf.byteLength > 2 + headerLen) {
              const header = new TextDecoder().decode(
                buf.slice(2, 2 + headerLen)
              );
              if (header.includes("Path:audio")) {
                audioChunks.push(new Uint8Array(buf.slice(2 + headerLen)));
              }
            }
          }
        }
      });

      ws.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket connection error"));
      });

      ws.addEventListener("close", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Send config
    ws.send(
      `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: "false",
                  wordBoundaryEnabled: "true",
                },
                outputFormat,
              },
            },
          },
        })
    );

    // Send SSML
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${escapeXml(text)}</prosody></voice></speak>`;
    ws.send(
      `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml}`
    );

    await done;

    if (audioChunks.length === 0) {
      return errorJson("No audio data received", 500);
    }

    // Concatenate chunks
    const totalLen = audioChunks.reduce((s, c) => s + c.byteLength, 0);
    const audio = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of audioChunks) {
      audio.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new Response(audio.buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
        ...CORS,
      },
    });
  } catch (err) {
    return errorJson(err.message || "Internal error", 500);
  }
}
