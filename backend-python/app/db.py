from pymongo import AsyncMongoClient

from .config import MONGODB_URI

client = AsyncMongoClient(MONGODB_URI)
db = client.get_default_database()

users = db["users"]
conversations = db["conversations"]
knowledge_embeddings = db["knowledgeembeddings"]
# Same docs re-embedded with nomic-embed-text (768-dim) — see app/ingest.py
knowledge_embeddings_nomic = db["knowledgeembeddings_nomic"]
