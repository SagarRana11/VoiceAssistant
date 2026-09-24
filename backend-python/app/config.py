import os
from pathlib import Path

from dotenv import load_dotenv

# Local .env wins; fall back to the Node backend's .env so secrets stay shared.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent.parent / "backend" / ".env")

MONGODB_URI = os.environ["MONGODB_URI"]
JWT_SECRET = os.environ["JWT_SECRET"]
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
# "gemini" (default) | "openai" | "mock". Falls back to mock if the chosen provider has no key.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
if (LLM_PROVIDER == "gemini" and not GEMINI_API_KEY) or (LLM_PROVIDER == "openai" and not OPENAI_API_KEY):
    print(f"[config] {LLM_PROVIDER} API key missing — using mock chat responses")
    LLM_PROVIDER = "mock"
# Embeddings: "ollama" (local nomic-embed-text, own Mongo collection) | "openai" (Node's vectors)
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "ollama").lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text:latest")
COHERE_API_KEY = os.getenv("COHERE_API_KEY", "")
CLIENT_URL = os.getenv("CLIENT_URL", "http://localhost:3000")
PORT = int(os.getenv("PY_PORT", "5002"))
