"""
LLM layer (LangChain). Chat provider is switchable: Gemini, OpenAI or local Ollama e.g. Qwen (LLM_PROVIDER).

Embeddings (EMBEDDING_PROVIDER):
  ollama → local nomic-embed-text; vectors live in `knowledgeembeddings_nomic`
  openai → text-embedding-3-small; vectors in Node's `knowledgeembeddings`
Query and document vectors must come from the same model.
"""
import asyncio
import math
import random
from collections.abc import AsyncIterator
from functools import lru_cache

from langchain_core.language_models import BaseChatModel

from .config import (
    EMBEDDING_PROVIDER,
    GEMINI_API_KEY, GEMINI_MODEL, LLM_PROVIDER,
    OLLAMA_BASE_URL,
    OLLAMA_CHAT_MODEL,
    OLLAMA_EMBED_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)

MOCK_RESPONSES = {
    "general": "Good question. Here's what I found in the knowledge base — in a real run the answer is grounded in the retrieved documents.",
    "therapist": "I hear you, and what you're sharing sounds really significant. Can you tell me more about when these feelings tend to be strongest?",
    "health": "Thank you for sharing that. Could you tell me how long you've been experiencing this, and rate the discomfort from 1 to 10?",
    "career": "That's a goal worth pursuing with real strategy. What's your current role and what does your ideal position look like in 2 to 3 years?",
    "fitness": "Let's GO! What's your current training frequency, available equipment, and the number one result you want in 8 weeks?",
}


@lru_cache
def get_chat_model(max_tokens: int = 500, temperature: float = 0.75) -> BaseChatModel:
    if LLM_PROVIDER == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            google_api_key=GEMINI_API_KEY,
            max_output_tokens=max_tokens,
            temperature=temperature,
            # Thinking tokens count against max_output_tokens and add latency; not needed for voice chat.
            thinking_budget=0,
        )
    if LLM_PROVIDER == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=OLLAMA_CHAT_MODEL,
            base_url=OLLAMA_BASE_URL,
            num_predict=max_tokens,
            temperature=temperature,
        )
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=OPENAI_MODEL,
        api_key=OPENAI_API_KEY,
        max_tokens=max_tokens,
        temperature=temperature,
    )


async def stream_chat(messages: list[dict], role_id: str) -> AsyncIterator[str]:
    """messages: [{role: system|user|assistant, content}] — LangChain accepts this shape directly."""
    if LLM_PROVIDER == "mock":
        await asyncio.sleep(0.7)
        words = MOCK_RESPONSES.get(role_id, MOCK_RESPONSES["therapist"]).split(" ")
        for i, w in enumerate(words):
            yield w + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.05 + random.random() * 0.06)
        return

    async for chunk in get_chat_model().astream(messages):
        if chunk.text:
            yield chunk.text


async def chat(messages: list[dict], max_tokens: int = 2000, temperature: float = 0.7) -> str:
    if LLM_PROVIDER == "mock":
        return ""
    res = await get_chat_model(max_tokens, temperature).ainvoke(messages)
    return res.text


# nomic-embed-text is trained with task prefixes; using them improves retrieval.
NOMIC_QUERY_PREFIX = "search_query: "
NOMIC_DOC_PREFIX = "search_document: "


@lru_cache
def _embeddings():
    if EMBEDDING_PROVIDER == "ollama":
        from langchain_ollama import OllamaEmbeddings

        return OllamaEmbeddings(model=OLLAMA_EMBED_MODEL, base_url=OLLAMA_BASE_URL)
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(model="text-embedding-3-small", api_key=OPENAI_API_KEY)


_embed_cache: dict[str, list[float]] = {}


async def embed(text: str) -> list[float]:
    """Embed a search query."""
    key = text[:200]
    if key in _embed_cache:
        return _embed_cache[key]
    if EMBEDDING_PROVIDER == "ollama":
        vec = await _embeddings().aembed_query(NOMIC_QUERY_PREFIX + text[:8000])
    elif OPENAI_API_KEY:
        vec = await _embeddings().aembed_query(text[:8000])
    else:
        vec = _mock_embedding(text)
    _embed_cache[key] = vec
    return vec


async def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed knowledge docs (ollama only — OpenAI doc vectors are owned by the Node backend)."""
    return await _embeddings().aembed_documents([NOMIC_DOC_PREFIX + t[:8000] for t in texts])


def _mock_embedding(text: str) -> list[float]:
    # Same deterministic scheme as embedder.ts so it matches mock vectors stored in Mongo.
    dim = 1536
    vec = [0.0] * dim
    for i, ch in enumerate(text.lower()):
        vec[(ord(ch) * (i + 1)) % dim] += 1
    norm = math.sqrt(sum(v * v for v in vec)) or 1
    return [v / norm for v in vec]
