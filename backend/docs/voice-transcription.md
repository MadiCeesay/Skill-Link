# Voice-note transcripts

Every voice note sent in chat gets an automatic text version underneath, so the other person can read it without playing it, and so voice notes are checked for contact details just like typed messages.

Code: `src/providers/ai/elevenlabs.provider.js` (ElevenLabs Scribe), `transcribeVoice` in `src/modules/conversations/conversation.service.js`, `VoiceTranscript` in `frontend/src/features/messaging.jsx`.

## How it works

1. The voice note is sent and saved as normal, with transcript status **PENDING**. Chat is never delayed.
2. In the background the server downloads the recording, sends it to ElevenLabs and stores the text and the detected language.
3. Both participants get a live `message-updated` event and the text appears under the voice note, labelled "Automatic transcript · may contain errors".

| Status | Shown to users |
|---|---|
| PENDING | "Writing out this voice note…" |
| DONE | The text and the spoken language |
| HIDDEN | The transcript contained a phone number, email or link before the booking was paid |
| FAILED | "Transcript not available" with a **Try again** button |

## Settings

```
ELEVENLABS_API_KEY=        # from https://elevenlabs.io, Speech to Text permission, server only
ELEVENLABS_MODEL=scribe_v2,scribe_v1   # backups are tried when the first fails
```

Without a key, voice notes work as before with no transcript. Failures are logged as `[transcription] …` without any audio or text.

## Measuring accuracy (for the report)

1. Record 30–50 short phrases a customer or worker might say, in Gambian Wolof, Mandinka and English, as `.ogg`, `.webm` or `.wav` files in `backend/transcription-eval/`.
2. For each, write the exact words in a `.txt` file with the same name (`01-roof.ogg` → `01-roof.txt`).
3. Run `node scripts/evaluate-transcription.mjs`.

It prints the **word error rate** (WER) for each recording and overall, and saves `results.csv`. WER = (wrong + missing + extra words) ÷ words actually spoken; 0% is perfect. Report it per language: this is original evidence of how well current speech AI handles Gambian languages.

Limitation: a transcript still PENDING when the server restarts stays pending; the participant can send the voice note again.
