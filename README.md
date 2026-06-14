# Debate Practice

Minimal audio-first debate practice app.

## Phase 1

- React + Vite project scaffold
- One-page debate practice interface
- Topic input
- Recording control placeholders
- Transcript editor
- Opponent reply area
- Coach score area
- API key environment template

## Phase 2

- Browser speech recognition for audio input
- Spoken argument appears on screen as transcript text
- Interim live text display while recording
- Editable transcript fallback
- Recording status and microphone error states

## Phase 3 + Voice Output

- `/api/debate` endpoint for an AI debate opponent
- OpenRouter integration through `OPENROUTER_API_KEY`
- Demo fallback response when no API key is present
- Opponent rebuttal appears on screen
- Browser text-to-speech reads the rebuttal aloud
- Coach scores and feedback can also be read aloud

## Phase 4

- Coach scorecard for the exchange
- Overall coach score
- Three simple dimensions: clarity, evidence, and debate strength
- Per-dimension feedback and score meters
- One concise improvement tip for the next turn

## Phase 5

- Auto-read toggle for spoken opponent replies
- Speaker buttons can stop active playback
- Coach decision with a clear verdict
- Coach next move for the user's follow-up turn
- Coach feedback diagnosis
- 2-3 concrete coach suggestions

## Run Locally

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` and add `OPENROUTER_API_KEY` for live AI responses.
The default live model is `nex-agi/nex-n2-pro:free`, configurable with `OPENROUTER_MODEL`.
Without a key, the app still runs in demo mode so the UI and voice flow can be tested.
