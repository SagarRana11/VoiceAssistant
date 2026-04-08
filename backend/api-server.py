"""
TTS Text-to-Speech API Server
==============================

A FastAPI server that converts raw text into speech audio using
TFLite FastSpeech + MelGAN models (LJSpeech).

Pipeline: text → character IDs → FastSpeech (mel) → MelGAN (audio) → WAV

Usage:
    pip install -r server_requirements.txt
    python api-server.py

Endpoints:
    POST /text2ids  — converts text to integer IDs
    POST /tts       — converts text to WAV audio
    GET  /health    — health check
"""

import io
import os
import wave
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# ─── LJSpeech Character-to-ID Mapping ───────────────────────────

_pad = "pad"
_eos = "eos"
_punctuation = "!'(),.:;? "
_special = "-"
_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

SYMBOLS = [_pad, _special] + list(_punctuation) + list(_letters) + [_eos]
SYMBOL_TO_ID = {s: i for i, s in enumerate(SYMBOLS)}
EOS_ID = SYMBOL_TO_ID[_eos]


def text_to_sequence(text: str) -> list[int]:
    """Convert text to a list of integer IDs (LJSpeech character set)."""
    ids = [SYMBOL_TO_ID[ch] for ch in text if ch in SYMBOL_TO_ID]
    ids.append(EOS_ID)
    return ids


# ─── TFLite Model Loading ───────────────────────────────────────

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
FASTSPEECH_PATH = os.path.join(MODEL_DIR, "fastspeech_quant.tflite")
MELGAN_PATH = os.path.join(MODEL_DIR, "melgan_quant.tflite")

SAMPLE_RATE = 22050

fastspeech_interpreter = None
melgan_interpreter = None


def load_tflite_models():
    global fastspeech_interpreter, melgan_interpreter

    import tensorflow as tf
    Interpreter = tf.lite.Interpreter

    print("Loading FastSpeech TFLite model...")
    fastspeech_interpreter = Interpreter(model_path=FASTSPEECH_PATH)
    print(f"  FastSpeech loaded. Inputs: {fastspeech_interpreter.get_input_details()}")

    print("Loading MelGAN TFLite model...")
    melgan_interpreter = Interpreter(model_path=MELGAN_PATH)
    print(f"  MelGAN loaded. Inputs: {melgan_interpreter.get_input_details()}")

    print("All TFLite models loaded!")


def run_fastspeech(input_ids: list[int]) -> np.ndarray:
    """Run FastSpeech TFLite: input_ids → mel spectrogram."""
    interpreter = fastspeech_interpreter
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    ids_array = np.array([input_ids], dtype=np.int32)
    seq_len = ids_array.shape[1]

    # Resize input_ids for variable-length input
    interpreter.resize_tensor_input(input_details[0]["index"], [1, seq_len])
    interpreter.allocate_tensors()

    # Set inputs: input_ids, speaker_ids, speed_ratios
    interpreter.set_tensor(input_details[0]["index"], ids_array)
    interpreter.set_tensor(input_details[1]["index"], np.array([0], dtype=np.int32))       # speaker_ids
    interpreter.set_tensor(input_details[2]["index"], np.array([1.0], dtype=np.float32))   # speed_ratios

    interpreter.invoke()

    # Output 0 is typically the mel spectrogram
    mel = interpreter.get_tensor(output_details[0]["index"])
    return mel


def run_melgan(mel: np.ndarray) -> np.ndarray:
    """Run MelGAN TFLite: mel spectrogram → audio waveform."""
    interpreter = melgan_interpreter
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    # MelGAN expects mel shape [1, mel_length, 80]
    interpreter.resize_tensor_input(input_details[0]["index"], mel.shape)
    interpreter.allocate_tensors()
    interpreter.set_tensor(input_details[0]["index"], mel.astype(np.float32))

    interpreter.invoke()

    audio = interpreter.get_tensor(output_details[0]["index"])
    # Output shape: [1, audio_length, 1] → flatten
    return audio.squeeze()


def audio_to_wav_bytes(audio: np.ndarray, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Convert float32 audio waveform to WAV bytes."""
    # Normalize to int16 range
    audio = audio / (np.max(np.abs(audio)) + 1e-7)
    audio_int16 = (audio * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(audio_int16.tobytes())
    buf.seek(0)
    return buf.read()


# ─── App Setup ────────────────────────────────────────────────

app = FastAPI(
    title="TTS Text-to-Speech API",
    description="Converts text to speech using FastSpeech + MelGAN TFLite models",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    load_tflite_models()


# ─── Request / Response Models ────────────────────────────────

class TextRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="The text to convert",
        json_schema_extra={"example": "Hello, how are you?"},
    )


class IDsResponse(BaseModel):
    input_ids: list[int]
    length: int
    text: str


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool


# ─── Endpoints ────────────────────────────────────────────────

@app.post("/text2ids", response_model=IDsResponse)
def text_to_ids(request: TextRequest):
    """Convert text to integer IDs for TFLite FastSpeech model."""
    try:
        input_ids = text_to_sequence(request.text)
        return IDsResponse(
            input_ids=input_ids,
            length=len(input_ids),
            text=request.text,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.post("/tts")
def text_to_speech(request: TextRequest):
    """
    Convert text to speech audio (WAV).

    Pipeline: text → IDs → FastSpeech (mel) → MelGAN (audio) → WAV
    Returns: audio/wav binary response
    """
    if fastspeech_interpreter is None or melgan_interpreter is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    try:
        # Step 1: Text to IDs
        input_ids = text_to_sequence(request.text)

        # Step 2: FastSpeech — IDs to mel spectrogram
        mel = run_fastspeech(input_ids)

        # Step 3: MelGAN — mel to audio waveform
        audio = run_melgan(mel)

        # Step 4: Convert to WAV
        wav_bytes = audio_to_wav_bytes(audio)

        return StreamingResponse(
            io.BytesIO(wav_bytes),
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=speech.wav"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


@app.get("/health", response_model=HealthResponse)
def health_check():
    """Check if the server and models are ready."""
    return HealthResponse(
        status="ok",
        models_loaded=fastspeech_interpreter is not None and melgan_interpreter is not None,
    )


# ─── Run Server ──────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5002))
    uvicorn.run(app, host="0.0.0.0", port=port)
