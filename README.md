# MeetScribe

A Chrome extension that records Google Meet sessions (tab video + your microphone audio) and automatically pipes the recording into a backend that stores it and extracts the audio — no manual downloading, no manual uploading.

> Repo name: `meet-recap` · Product name: **MeetScribe**

---

## The full picture

MeetScribe's end goal is a complete meeting-recap agent: **join a call, and walk away with a saved recording, a transcript, and a structured summary — automatically, with no manual file handling at any step.**

That's a big pipeline, so it's being built and shipped in phases rather than all at once:

1. **Capture & storage** — reliably get the raw recording *out* of the browser and *into* a backend with zero manual steps. This is the unglamorous but necessary foundation everything else sits on — if step 1 involves you manually copying files around, nothing built on top of it can be automatic either.
2. **Speech-to-text** — turn the extracted audio into a transcript.
3. **Accuracy work / fine-tuning** — make sure that transcript is actually usable on real meeting audio (multiple speakers, domain vocabulary, background noise), not just a generic API call.
4. **Summarization** — turn a transcript into an actual recap: key points, decisions, action items.

**What you're looking at in this repo right now is Phase 1**, fully working end-to-end: recording → automatic upload → automatic audio extraction → database. It's a self-contained piece (the extension genuinely works standalone today), but its real purpose is to be the reliable base the rest of the pipeline is built on — every later phase depends on step 1 never requiring a human in the loop.

---

## How it works (Phase 1)

```
┌─────────────┐      ┌──────────────┐      ┌────────────────┐      ┌──────────────┐
│  popup.js   │─────▶│ background.js│─────▶│  offscreen.js   │─────▶│   FastAPI     │
│ (start/stop │      │ (coordinator,│      │ (captures tab + │      │   backend     │
│  button UI) │◀─────│  badge, msgs)│◀─────│  mic, records,  │      │               │
└─────────────┘      └──────────────┘      │  uploads)       │      └──────┬───────┘
                                            └──────────────────┘             │
                                                                              ▼
                                                                    ┌──────────────────┐
                                                                    │ SQLite (recap_    │
                                                                    │ agent.db)          │
                                                                    │ + saved .webm      │
                                                                    │ + extracted .mp3   │
                                                                    └──────────────────┘
```

1. **`popup.js`** — the extension's UI. Start/Stop buttons, mic permission status, live recording status.
2. **`background.js`** — the service worker. Enables the extension icon only on `meet.google.com` tabs, creates the offscreen document, relays messages between the popup and the recorder, and updates the toolbar badge (`REC` → `...` → `OK`/`ERR`).
3. **`offscreen.js`** — does the actual work. Captures the tab's video + your microphone's audio via `getUserMedia`/`tabCapture` (mixed into one clean stream so tab audio doesn't get double-recorded), records it with `MediaRecorder`, and the moment recording stops: uploads the `.webm` straight to the backend and immediately triggers audio extraction — no file ever touches your Downloads folder.
4. **FastAPI backend (`app/`)** — receives the upload (`/upload`), saves it to disk, creates a database row, extracts the audio track with `ffmpeg` (`/extract-audio/{class_id}`), and writes the resulting audio path back to that same row.
5. **SQLite (`recap_agent.db`)** — one row per recording, tracking `class_id`, `video_path`, `audio_path`, and status.

---

## Tech stack

- **Extension:** Manifest V3, `chrome.tabCapture`, `chrome.offscreen`, `MediaRecorder` API, vanilla JS
- **Backend:** FastAPI, Uvicorn, `python-multipart` for file uploads
- **Media:** `ffmpeg` (via a thin Python wrapper) for audio extraction
- **Storage:** SQLite

---

## Project structure

```
meet-recap/
├── manifest.json          # Extension config, permissions, host_permissions
├── background.js           # Service worker: coordination, badge, message routing
├── offscreen.js             # Recording, capture, upload + audio-extraction trigger
├── popup.html / popup.js / popup.css   # Extension UI
├── options.html / options.js           # Microphone permission grant flow
└── app/                    # FastAPI backend
    ├── main.py              # Routes: /upload, /extract-audio/{id}, /classes/{id}
    ├── db.py                # SQLite read/write helpers
    ├── ffmpeg_utils.py       # Audio extraction wrapper around ffmpeg
    └── config.py             # Upload/audio directory config
```

---

## Setup

### Backend

Create and activate a virtual environment first — this keeps the project's Python dependencies isolated from your system install and is not something you commit to the repo:

```bash
cd app/..                      # repo root
python -m venv meetex
source meetex/bin/activate     # Windows: meetex\Scripts\activate
pip install -r requirement.txt
uvicorn app.main:app --reload --port 8000
```

Make sure `ffmpeg` is installed and on your `PATH` — the audio-extraction step shells out to it.

### Extension

1. Go to `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select the repo root.
3. Open the extension's **Options** page once to grant microphone permission.
4. Open a `meet.google.com` tab — the extension icon activates only there.
5. Click **Start Recording**, join/host your meeting, click **Stop** when done. The badge will show `...` while it uploads and extracts audio, then `OK`.

By default the extension talks to `http://127.0.0.1:8000` — change `BACKEND_URL` at the top of `offscreen.js` if you run the backend elsewhere.

---

## Roadmap

- [x] **Phase 1 — Capture & storage pipeline** *(current)*
  Record tab video + mic audio from a Google Meet tab, automatically upload to a FastAPI backend, save the file, extract the audio track, and persist both paths to the database. Zero manual file handling.

- [ ] **Phase 2 — Speech-to-text**
  Wire the extracted audio into an STT step (starting with an existing API/model) so each recording gets a transcript stored alongside it.

- [ ] **Phase 3 — Fine-tuning / accuracy work**
  Evaluate STT accuracy on real meeting audio (domain vocabulary, multiple speakers, background noise) and explore fine-tuning against a general-purpose baseline — with a proper before/after comparison, not just swapping a model.

- [ ] **Phase 4 — Summarization / recap generation**
  Turn a transcript into an actual structured recap (key points, action items) — the "Scribe" part of MeetScribe.

---

## License

MIT (or update this section to whatever you prefer before publishing).