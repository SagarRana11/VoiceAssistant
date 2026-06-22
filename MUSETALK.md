# MuseTalk Integration Guide

## What is MuseTalk?

MuseTalk is a real-time, **local** audio-driven lip-sync model by Tencent Music Entertainment (Lyra Lab). It takes an audio clip + a reference face image and generates a video where the face's lips move in sync with the audio — all running on your own machine, no API key needed.

**In this project it replaces / supplements D-ID and HeyGen** as a third avatar option.

---

## Architecture Overview

```
User speaks
    │
    ▼
Web Speech API (browser)
    │
    ▼
ElevenLabs TTS → WAV audio
    │
    ▼
[NEW] /api/musetalk/lipsync (Node.js backend)
    │
    ▼
MuseTalk Python Server (port 5003)
    │  audio + reference image → lip-synced video
    ▼
Frontend: useMuseTalkStream.ts hook
    │
    ▼
Avatar video plays in TalkWorkspace
```

---

## Installation Phases

### Phase 1 — System Prerequisites
- Check for NVIDIA GPU (≥4GB VRAM) and CUDA 11.7/11.8
- Verify 20GB+ free disk space

### Phase 2 — Install Miniconda
- Conda is a Python environment manager
- Creates isolated "bubbles" so MuseTalk's specific library versions don't conflict with other projects
- We install the lightweight version: **Miniconda**

### Phase 3 — Clone MuseTalk & Create Environment
- Clone MuseTalk source code from GitHub
- Create a conda environment named `MuseTalk` with Python 3.10
- Install PyTorch 2.0.1 (with CUDA 11.8) + all dependencies

### Phase 4 — Install FFmpeg
- FFmpeg is a video processing tool required for reading/writing video files
- On Linux: download static binary; on Mac: `brew install ffmpeg`

### Phase 5 — Download Model Weights (~5-8GB)
- 6 AI model files downloaded automatically from HuggingFace
- Stored in `MuseTalk/models/` directory

| Model | Purpose |
|-------|---------|
| MuseTalk v1.5 UNet | Core lip-sync network |
| Stable Diffusion VAE | Encodes images for AI processing |
| Whisper-tiny | Extracts audio features |
| DWPose | Detects face and landmarks |
| SyncNet | Keeps audio and lips in sync |
| Face Parse BiSeNet | Segments the face region |

### Phase 6 — Test Standalone Inference
- Run MuseTalk on sample files included in the repo
- Verify output MP4 video is generated correctly
- Optional: Launch Gradio web UI at http://localhost:7860 for visual testing

### Phase 7 — Create MuseTalk API Server
- Wrap MuseTalk in FastAPI (port 5003)
- Pattern mirrors existing `api-server.py` (port 5002) in this project
- Endpoint: `POST /lipsync` → accepts audio + image, returns video

### Phase 8 — Voice Assistant Backend Integration
- New route: `backend/src/routes/musetalk.ts`
- New controller: `backend/src/controllers/musetalKController.ts`
- Proxy requests from frontend → MuseTalk server
- Add `MUSETALK_API_URL` and `MUSETALK_ENABLED` to `backend/.env`

### Phase 9 — Frontend Hook Integration
- New hook: `frontend/src/hooks/useMuseTalkStream.ts`
- Mirrors `useDIDStream.ts` and `useHeyGenStream.ts` patterns
- Update `TalkWorkspace.tsx` to show MuseTalk as a third avatar option
- Update `useAppStore.ts` to add 'musetalk' to avatar type

---

## Files Modified / Created

| File | Action | Purpose |
|------|--------|---------|
| `MUSETALK.md` | Created | This documentation |
| `MuseTalk/musetalk_server.py` | Created | FastAPI wrapper server |
| `backend/.env` | Modified | Add MuseTalk config vars |
| `backend/src/routes/musetalk.ts` | Created | Express route |
| `backend/src/controllers/musetalKController.ts` | Created | Business logic |
| `backend/src/index.ts` | Modified | Register new route |
| `frontend/src/hooks/useMuseTalkStream.ts` | Created | React hook |
| `frontend/src/workspaces/TalkWorkspace.tsx` | Modified | Add avatar option |
| `frontend/src/store/useAppStore.ts` | Modified | Add 'musetalk' type |

---

## Running MuseTalk Server

```bash
# Always activate the conda environment first
conda activate MuseTalk
cd path/to/MuseTalk

# Start the API server
python musetalk_server.py
# Server runs on http://localhost:5003
```

---

## Verification Checklist

- [ ] Phase 1: `nvcc --version` shows CUDA 11.7 or 11.8
- [ ] Phase 2: `conda --version` works after install
- [ ] Phase 3: `conda activate MuseTalk` — prompt shows `(MuseTalk)`
- [ ] Phase 4: `python test_ffmpeg.py` prints "FFmpeg OK"
- [ ] Phase 5: `models/` directory has all 6 model folders
- [ ] Phase 6: `sh inference.sh v1.5 normal` produces MP4 in `results/`
- [ ] Phase 7: `curl http://localhost:5003/health` → 200 OK
- [ ] Phase 8: POST `/api/musetalk/lipsync` → returns video blob
- [ ] Phase 9: MuseTalk avatar option appears in Voice Assistant UI

---

## Notes

- **Mac CPU mode:** Works but slow (10-30s per clip). Good for development/testing.
- **Real-time performance:** Requires NVIDIA GPU (30+ FPS on V100).
- **Existing avatars (D-ID, HeyGen):** Not changed — MuseTalk is additive.
- **conda deactivate:** Run this when done to exit the MuseTalk environment.
