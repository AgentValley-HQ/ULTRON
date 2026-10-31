# Ultron

**An autonomous voice agent that runs on your own machine, talks to you, and gets your daily tasks done through your connected accounts.**

Developed by Agent Valley.

---

## What Ultron is

Ultron is a locally-hosted assistant. You open it in your browser, either hold the space bar or **double-clap**, speak a request, and go quiet. Ultron hears you, decides what to do, calls the right tool on your behalf, and reads the answer back to you in Adrian's deep male voice.

Unlike cloud assistants that live on someone else's server, Ultron runs entirely on your machine. The humanoid interface, the Node.js backend, your API keys, and your conversation memory never leave your computer. The only outbound traffic goes to the specific AI providers you choose to use (Soniox for voice, TypeSafe for routing, Anthropic for reasoning). You own the setup end-to-end.

What makes Ultron different from a thin wrapper around an LLM is a two-layer architecture:

1. A fast **routing + guardrail layer** (powered by TypeSafe's Jev model) that picks the right tool and risk-checks every action in milliseconds.
2. A **reasoning + action layer** (powered by the Claude Agent SDK) that actually understands your request, calls real tools, and composes the answer.

The result is an assistant that is both quick to decide and safe to act — it will never silently send an email, book a meeting, or delete a file without showing you exactly what it is about to do.

---

## What you can ask it to do, every day

Below are concrete examples. Each one triggers the pipeline described later in this file.

### Email

- "Check my unread emails."
- "Any emails from Priya today?"
- "Draft a reply to the last message from Rohan saying I'll join by three."
- "Send the drafted email to Swanand."
- "Summarise the top three emails in my inbox."
- "Mark the Linear notifications as read."

### Calendar

- "What meetings do I have today?"
- "Am I free tomorrow at four?"
- "Book a thirty minute call with Priya on Friday at eleven."
- "Move my three p.m. standup to four."
- "What is on my calendar for next Monday morning?"

### Notes and docs (Notion)

- "Find my notes about the Q3 launch."
- "Create a new page called Ultron testing log under personal."
- "Append today's standup notes to the engineering journal."

### Files (Google Drive)

- "Find the pricing deck I made last month."
- "Share the Q4 roadmap doc with the leadership folder."
- "What was in the file called onboarding one-pager?"

### Design (Canva)

- "Open my latest Instagram post design."
- "Export the launch poster as a PNG."

### Media (Higgsfield)

- "Generate a cinematic image of a lonely astronaut on Mars."
- "Make a fifteen second looping video of neon rain on a city street."


### Conversation memory

Within the same browser tab, Ultron remembers what you said. You can chain requests:

- You: "Draft an email to Swanand saying I'll be late."
- Ultron: "Drafted. Shall I send it?"
- You: "Read it back to me first." (session memory kicks in — Ultron knows what "it" refers to)
- You: "Change the tone to friendlier." (still the same draft)
- You: "Now send it." (approval modal appears)

Refreshing the tab starts a fresh session.

---

## How you operate it

### What happens on refresh

Open the page and sit back. About **5 seconds after the page loads**, Ultron automatically:
- Arms the clap listener (browser may prompt for microphone permission on your first visit).
- Greets you in Adrian's voice: *"Hey buddy, what's up? What are today's tasks?"*

The status tag flashes `CLAP WAKE ARMED` for 2 seconds, then settles to `READY · HOLD SPACE OR CLAP`.

**First-ever visit note.** The very first time you open the page in a new browser profile, Chrome / Edge needs a click to grant microphone permission and unlock audio playback — that is a browser rule, not an Ultron limitation. One click, allow the mic, and from that moment every refresh works instantly with no interaction needed.

### Two ways to wake Ultron

You can activate Ultron in either of two ways, both work out of the box:

**(1) Hold the space bar — classic push-to-talk.**

1. Hold `Space`. The dock mic button pulses cyan, the screen edge glows cyan, and the humanoid's audio-reactive animation starts moving to your voice. The caption bar shows your words appearing live.
2. Speak your request.
3. Release `Space`. Your transcript is submitted, the dock button flips to **thinking**, Ultron answers.

**(2) Double-clap — hands-free, Jarvis-style.**

1. **Clap twice sharply** (about half a second between the two claps). The dock mic button pulses, Ultron enters listening mode exactly as if you had held space.
2. **Speak your request** at a normal volume.
3. **Go quiet.** After about 1.5 seconds of silence, Ultron auto-submits and answers.

The clap wake uses a dedicated audio analyser that monitors three signals (loudness, 2–5 kHz band ratio, spectral flatness) to distinguish a clap from a door slam or hand slap. Two transients 150–800 ms apart trigger the wake. A single clap, random thuds, and background noise are all ignored.

### What else happens during a conversation

- **If Ultron is about to take an action** (sending an email, booking a meeting, deleting a file, running a shell command, etc.), a confirmation modal appears in the middle of the screen with a human-readable preview and an **Approve / Deny** choice.
- **Barge in anytime.** If Adrian is talking and you want to interrupt, just hold space again — or clap twice. His voice cuts off instantly and he listens to you.
- **Session memory.** Within the same browser tab, Ultron remembers prior turns. Refresh to start fresh.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` (hold) | Push-to-talk microphone |
| `1` – `4` | Manually set state (idle / listening / thinking / speaking). For debugging. |
| `EXIT` button | Ends the session; a "RESUME" overlay appears to restart. |

### What each dock button means

The dock at the bottom of the screen shows four state radio buttons plus a mic, clap, and sound button:

- **idle** — ready for input.
- **listening** — the microphone is active and streaming audio to the speech-to-text service.
- **thinking** — the request has been routed and the reasoning model is working on an answer (possibly calling tools).
- **speaking** — audio is streaming back from the text-to-speech service and playing.
- **MIC** button — click to start/stop listening (same as holding space).
- **CLAP ON / CLAP OFF** button — toggles the clap-wake listener. Starts in `CLAP ON`. When off, the browser's microphone-in-use indicator disappears and double-clapping has no effect; only space bar wakes Ultron.
- **SOUND** button — toggles whether Ultron is allowed to speak.

---

## How it works under the hood

Here is the full round-trip for a single request, from your voice back to your ears:

```
            (1) hold space
                 │
                 ▼
     browser (public/index.html)
     captures mic as 16-bit PCM
     at the AudioContext's native rate
                 │
                 │  binary WebSocket frames
                 ▼
     Node server (server/index.ts)
     forwards PCM to Soniox STT
                 │
                 │  wss://stt-rt.soniox.com
                 ▼
         Soniox streaming STT
         returns live interim and
         final transcript tokens
                 │
                 ▼
     final transcript hits
     the pipeline, state → thinking
                 │
                 ▼
       (2) JEV ROUTER (server/router.ts)
       one Jev call picks:
         - connector  (gmail | calendar | notion | drive | canva | higgsfield | none)
         - model      (haiku | sonnet | opus)
         - missing    (0..1 — is the user missing info?)
                 │
                 ▼
       (3) CLAUDE AGENT SDK (server/executor.ts)
       spawns Claude with a minimal
       system prompt + scoped tools
                 │
                 ▼
       Claude decides whether to call a tool
                 │
          ┌──────┴──────┐
          │             │
     safe tool       sensitive tool
     (WebSearch,     (mcp__Gmail__*,
      WebFetch,       Bash, Write,
      Read, Grep)     Edit, …)
          │             │
     auto-allow         ▼
                 (4) JEV GATE (server/gate.ts)
                 one Jev call scores:
                   - upset    (0..1 — could this upset the reader?)
                   - commits  (0..1 — does this commit money/time/promises?)
                 │
                 ▼
                 modal appears in the
                 browser with a preview
                 and APPROVE / DENY
                 buttons. Claude waits.
                 │
                 ▼
                 tool runs if approved
          │             │
          └──────┬──────┘
                 ▼
     Claude composes the final answer
                 │
                 ▼
     answer sent to Soniox TTS
                 │
                 │  wss://tts-rt.soniox.com
                 │  audio_format: wav, 24 kHz
                 ▼
      Soniox streams back audio chunks
                 │
                 ▼
     server strips WAV header, forwards
     raw PCM to the browser as binary WS
                 │
                 ▼
     browser schedules PCM chunks on a
     Web Audio AudioContext — Adrian speaks
                 │
                 ▼
            (5) you hear it
```

### What each layer actually is

- **`public/index.html`** — the single-page browser UI. A three.js humanoid avatar that reacts to your voice, a WebSocket client, PCM mic capture via ScriptProcessorNode at the browser's native sample rate, and PCM playback via scheduled AudioBufferSourceNodes for gapless streaming.
- **`server/index.ts`** — a Node.js Express + ws server. Serves the static HTML, exposes a single WebSocket at `/ws`, and orchestrates the per-request pipeline (STT → router → executor → gate → TTS). All instrumentation is written here with colored timestamps.
- **`server/voice.ts`** — thin wrappers around Soniox's two WebSocket endpoints. Handles STT connection lifecycle (config → audio bytes → tokens → end signal) and TTS (config → text → audio bytes → terminated).
- **`server/router.ts`** — the Jev-powered command router. A single `systemOne` call with three questions.
- **`server/gate.ts`** — the Jev-powered risk gate. A single `systemOne` call with two risk questions.
- **`server/executor.ts`** — the Claude Agent SDK wrapper. Spawns Claude with the minimal custom system prompt, the per-route allowed tools list, the identity + guardrail block, and the user's resumed session ID.
- **`server/log.ts`** — the ANSI-color timestamped logger.
- **`server/types.ts`** — shared WebSocket message types between client and server.

### Why Jev, specifically

Jev is TypeSafe AI's "System One" model — a frontier model optimised for structured, probabilistic decisions in milliseconds, not for chat. Ultron uses it in two places where a full-size LLM would be overkill:

**1. The command router (`server/router.ts`).**

Instead of asking a large language model "which connector should I use for this request?", we hand Jev the user's transcript and three typed questions in a single call:

```ts
const { answers } = await jev().systemOne({
  state: { request: userText },
  questions: {
    connector: choice("Which connector should handle this request?", {
      gmail:      "Reading, searching, sending, drafting or replying to email.",
      calendar:   "Scheduling, finding or cancelling meetings; checking availability.",
      notion:     "Reading, searching, creating or updating pages and databases.",
      drive:      "Searching, reading, uploading or sharing files.",
      canva:      "Creating, editing or exporting designs.",
      higgsfield: "Generating images, video, voice or any media.",
      none:       "Pure conversation, a math question, or anything that needs no outside tool.",
    }),
    model: choice("Which Claude model fits the job?", {
      haiku:  "A quick lookup, a short reformat, a single-fact answer.",
      sonnet: "A normal multi-step task.",
      opus:   "Deep reasoning or something risky where mistakes are expensive.",
    }),
    missing: noul("The user has not supplied enough detail for Ultron to act without guessing."),
  },
});
```

Jev returns a typed object with the chosen enum values and calibrated confidence scores. The pipeline uses this to:

- Pick the right connector hint for the executor.
- Scale the model tier up for complex tasks and keep it at the fast tier for simple ones.
- Short-circuit back to the user with a clarifying question if `missing > 0.65`.

If `TYPESAFE_API_KEY` is not set, a plain regex heuristic fills in — Ultron still works, just with less nuanced routing.

**2. The "act or ask" risk gate (`server/gate.ts`).**

Every time Claude attempts to call a sensitive tool (anything in a connector, or a shell/write operation), the proposed call is handed to Jev with two risk questions:

```ts
const { answers } = await jev().systemOne({
  state: {
    user_request: originalRequest,
    action_about_to_happen: draftOrAction,
  },
  questions: {
    upset:   noul("Sending or posting this exactly as written could confuse, upset or offend the recipient."),
    commits: noul("This action commits the user to money, a specific date or time, or a concrete promise."),
  },
});
```

The returned probabilities drive the risk tier displayed in the approval modal (low / medium / high) and inform your decision. The approval modal always appears for any mutating connector call; Jev's role here is to tell you *how* risky the action is at a glance, not whether to show the gate at all.

### Choosing your providers (Claude / OpenAI, Soniox / ElevenLabs)

Ultron supports multiple vendors for both the reasoning layer and the voice layer. On startup the server picks the first available one in priority order and logs the choice. You never need to change code — just set or unset the relevant environment variable in `.env`.

**Reasoning layer** (priority order):

| Priority | Env var | What you get |
|---|---|---|
| 1 | `ANTHROPIC_API_KEY`, or `claude /login` on this machine | **Full Ultron**: connectors, tool use, approval modals, session memory. |
| 2 | `OPENAI_API_KEY` | **Text-only Ultron**: general Q&A via chat completions. **No connector or shell tools** — Ultron will tell you it cannot act in this mode and offer an informational answer instead. |
| 3 | (nothing) | Mock mode — echoes your request. |

Default OpenAI model mapping: `gpt-4o-mini` for the haiku and sonnet tiers, `gpt-4o` for opus. Override any tier with `OPENAI_MODEL_FAST`, `OPENAI_MODEL`, `OPENAI_MODEL_SMART`.

**Voice layer** (priority order):

| Priority | Env var | What you get |
|---|---|---|
| 1 | `ELEVENLABS_API_KEY` | Premium ElevenLabs voices via streaming PCM. Default voice is Adam (deep male); override with `ELEVENLABS_VOICE_ID`. The sample rate defaults to 24 kHz; the free tier may not support that, so set `ELEVENLABS_SAMPLE_RATE=22050` or `16000` if you are on free. |
| 2 | `SONIOX_API_KEY` | Soniox Adrian voice + Soniox streaming STT. |
| 3 | (nothing) | Browser-native Web Speech API — works but robotic. |

The server's startup banner tells you which combination is in use:

```
HH:MM:SS [INFO  ] jev:    real
HH:MM:SS [INFO  ] llm:    claude (env API key)
HH:MM:SS [INFO  ] tts:    elevenlabs (server-side)
```

Note: speech-to-text always uses Soniox when `SONIOX_API_KEY` is set, otherwise it falls back to the browser's Web Speech API. ElevenLabs is TTS-only — it does not provide STT in Ultron.

### Why Claude for the reasoning

The Claude Agent SDK is the one layer that genuinely needs a large language model: understanding natural language requests, composing a plan, iterating on tool outputs, and writing the final answer in a voice-friendly tone. Ultron uses Claude Haiku 4.5 by default — the fastest model in the family — and only escalates to Sonnet or Opus when Jev's router asks for it. The agent SDK is spawned with:

- A **minimal custom system prompt**, not Claude Code's default preset. This strips ~5000 tokens of file/shell/MCP boilerplate off every call.
- A **scoped allowed-tools list** per route. For general knowledge, only WebSearch and WebFetch are exposed. For connectors, the connector's own tools are included.
- A **permission callback** (`canUseTool`) that forwards every mutating or connector tool call through the Jev gate and the user-facing approval modal.
- A **session resume ID** so follow-up requests on the same WebSocket preserve context.

### Why Soniox for voice

Browser-native speech recognition (`webkitSpeechRecognition`) and synthesis (`speechSynthesis`) work, but their quality is uneven and the voices are robotic. Soniox gives Ultron:

- A streaming STT WebSocket that returns token-level interim transcripts with endpoint detection (so Ultron knows when you stop talking).
- A low-latency TTS WebSocket with the Adrian voice — a warm, deep male voice that fits a Jarvis-style assistant.

Both services sit behind a single environment variable (`SONIOX_API_KEY`). If it is unset, Ultron falls back to the browser's built-in Web Speech API so you can still try everything without an account.

---

## Prerequisites

- **Windows 10/11, macOS, or Linux** with a working microphone.
- **Node.js 22 or newer.** (`node -v` must print `v22.*` or higher.)
- **A modern Chromium-based browser** (Chrome or Edge recommended). Firefox and Safari do not fully implement the Web Speech API; they still work with Soniox but the fallback mode will not.
- **(Optional, strongly recommended) a logged-in Claude Code CLI session** on the same machine. Install Claude Code, then run `claude /login` once and sign in through the browser. Ultron auto-detects the credential file at `~/.claude/.credentials.json` and uses it. Without this, Ultron runs in mock mode (echoes requests back to you).
- **(Optional) a TypeSafe API key** from [console.typesafe.ai](https://console.typesafe.ai/) for real Jev routing and gating.
- **(Optional) a Soniox API key** from [console.soniox.com](https://console.soniox.com) for real streaming voice.

Ultron works with zero paid keys — the fallbacks are good enough to try it. For a real daily driver, set at least the Claude CLI login and the Soniox key.

---

## Install and run

```powershell
cd Desktop\jarvis
npm install
```

Then create a `.env` file at the project root (next to `package.json`):

```
PORT=5173

# TypeSafe Jev — fast structured decisions. Leave blank for regex fallback.
TYPESAFE_API_KEY=

# Claude Agent SDK auth. Leave blank if `claude /login` is done on this machine.
ANTHROPIC_API_KEY=

# Soniox voice. Leave blank for browser Web Speech fallback.
SONIOX_API_KEY=
# Optional:
# SONIOX_VOICE=Adrian
# SONIOX_LANG=en
```

Start the server:

```powershell
npm run dev
```

You should see the colored startup banner:

```
HH:MM:SS [INFO  ] ultron listening on http://localhost:5173
HH:MM:SS [INFO  ] jev:    real
HH:MM:SS [INFO  ] claude: CLI OAuth (if logged in) else mock
HH:MM:SS [INFO  ] voice:  soniox (server-side)
```

Open [http://localhost:5173](http://localhost:5173) in Chrome or Edge. Click once anywhere on the humanoid. Grant microphone access when prompted. You should hear Adrian greet you.

### The two npm scripts

- `npm run dev` — development mode. Uses `tsx watch` so the server restarts whenever any file in `server/` changes. Logs stream to the terminal.
- `npm run start` — one-shot run. No auto-restart. Useful when you want a stable background process.

---

## Local hosting and privacy

- Everything runs on `localhost:5173`. Nothing in your conversation history is ever sent to anyone except the three AI providers above, and only the request text and audio bytes needed to answer the current turn.
- API keys live in your local `.env` file. Add `.env` to your `.gitignore` before you ever commit this project — the `.env.example` is the only version meant to be shared.
- Session memory is stored in the Claude Agent SDK's per-session JSONL file on your machine. Refreshing the browser tab starts a new session.
- Logs are written only to your terminal, never to disk.

If you want to run Ultron on a server for a small team, place it behind a reverse proxy with authentication (nginx + basic auth is enough for a trusted LAN). The WebSocket is at `/ws` and must share the same origin and auth.

---

## Guardrails

Ultron has three layers of safety on top of whatever Claude does on its own:

**1. Confirm every connector action.** Every call into Gmail, Calendar, Notion, Drive, Canva, Higgsfield, every `Bash`, every `Write` or `Edit` pops the "SHALL I PROCEED?" modal with a human-readable preview of the action and the two Jev risk scores. Only `WebSearch`, `WebFetch`, `Read`, `Grep`, `Glob`, and `TodoWrite` auto-allow (they are side-effect-free).

**2. Jev-scored risk.** The modal shows the risk tier (low / medium / high) based on Jev's two noul probabilities: *could this upset the reader* and *does this commit money or time or a promise*. High-risk actions still require your tap, but the colour and copy of the modal shift so you pay more attention.

**3. Identity + tech guardrails.** When asked who it is or what it is built on, Ultron answers only with its own identity ("I am Ultron, an autonomous agent built by Agent Valley") and declines to disclose the underlying technology. This keeps users focused on tasks and away from prompt-engineering probes.

---

## Troubleshooting

**No sound on first click.** Browser audio is blocked until you interact with the page. Click once anywhere on the humanoid; the primer utterance unlocks it and the greeting plays.

**"MIC BLOCKED" in the status tag.** The browser denied microphone permission. Click the lock icon in the address bar, set the microphone to Allow, and refresh.

**Nothing happens when you hold space.** The WebSocket is probably not connected. Check the top-left `WS open` log in the browser console (F12). If missing, the server is not running — restart with `npm run dev`.

**Claude never responds.** Check the terminal. If you see no `[RECV]` line, STT did not catch your voice (speak louder or longer). If you see `[RECV]` but no `[DONE]`, Claude SDK is failing — most commonly because `claude /login` has not been done.

**TTS says `invalid voice`.** Soniox renamed or retired the voice. Open [console.soniox.com](https://console.soniox.com), find a voice you like, and set `SONIOX_VOICE=TheirName` in `.env`.

**TTS hangs.** The pipeline has a 15-second safety timeout; after that the server logs `Soniox TTS timeout — forcing close` and resets. If this happens repeatedly, check your Soniox account for rate limit or billing issues.

**Clap doesn't wake Ultron.** Open the browser console (F12) and clap. You should see `[Ultron] clap transient (…)` lines for each individual clap, then `[Ultron] double-clap detected (gap=…ms)` when two land within 150–800 ms. If you only see transients, your two claps are too far apart or too close together — try again faster/slower. If you see nothing, the clap listener isn't armed — click the `CLAP ON` button in the dock. If the button shows `CLAP OFF` and refuses to turn on, mic permission was denied; click the browser lock icon → allow mic → refresh.

**Clap triggers on random noises** (door slams, keyboard typing). Open [public/index.html](public/index.html), search for `CLAP_RMS_THRESHOLD`, and raise it (0.30 → 0.40). Also consider raising `CLAP_BAND_RATIO` and `CLAP_FLATNESS`. Hard refresh to apply.

**Clap wakes Ultron but mic doesn't hear you.** Check the terminal for `[RECV] mic_start`. If missing, the shared mic source isn't flowing; refresh and try again. If present but no transcript, speak louder — the silence-detection threshold may be auto-calibrating to your room noise.

---

## Credits

Built by Agent Valley. Voice by Soniox (Adrian). Decisions by TypeSafe AI (Jev). Reasoning by the Claude Agent SDK. Three.js humanoid interface courtesy of the included avatar module.
