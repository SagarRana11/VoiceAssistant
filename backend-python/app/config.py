import os
from pathlib import Path

from dotenv import load_dotenv

# Standalone service — only backend-python/.env is read (no dependency on the Node backend).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost/voice_assistant")
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", "7"))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
# "gemini" (default) | "openai" | "mock". Falls back to mock if the chosen provider has no key.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
if (LLM_PROVIDER == "gemini" and not GEMINI_API_KEY) or (LLM_PROVIDER == "openai" and not OPENAI_API_KEY):
    print(f"[config] {LLM_PROVIDER} API key missing — using mock chat responses")
    LLM_PROVIDER = "mock"
# Embeddings: "ollama" (local nomic-embed-text, 768-dim) | "openai" (text-embedding-3-small, 1536-dim)
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "ollama").lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text:latest")
# pgvector column size — must match the embedding model (changing it needs the table recreated)
EMBED_DIM = 768 if EMBEDDING_PROVIDER == "ollama" else 1536
COHERE_API_KEY = os.getenv("COHERE_API_KEY", "")
CLIENT_URL = os.getenv("CLIENT_URL", "http://localhost:3000")
PORT = int(os.getenv("PY_PORT", "5002"))
