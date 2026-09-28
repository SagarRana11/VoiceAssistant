"""Postgres (SQLAlchemy async + pgvector) — users, conversations, messages, knowledge embeddings, employees."""
import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, Computed, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .config import DATABASE_URL, EMBED_DIM

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
Session = async_sessionmaker(engine, expire_on_commit=False)


def now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class User(Timestamps, Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))


class Conversation(Timestamps, Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_user_updated", "user_id", "updated_at"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role_id: Mapped[str] = mapped_column(String(32))
    role_name: Mapped[str] = mapped_column(String(100))
    messages: Mapped[list["Message"]] = relationship(
        order_by="Message.timestamp", cascade="all, delete-orphan", passive_deletes=True
    )


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class KnowledgeEmbedding(Timestamps, Base):
    __tablename__ = "knowledge_embeddings"
    __table_args__ = (UniqueConstraint("doc_id", "domain", name="uq_knowledge_doc_domain"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    doc_id: Mapped[str] = mapped_column(String(200))
    domain: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBED_DIM))
    content_hash: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(100))


class HrmsParent(Timestamps, Base):
    """Parent section / article / table / slide of a company policy PDF — what the LLM reads (small-to-big)."""
    __tablename__ = "hrms_parents"
    parent_id: Mapped[str] = mapped_column(String(200), primary_key=True)
    doc: Mapped[str] = mapped_column(String(100), index=True)
    title: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)


class HrmsChunk(Timestamps, Base):
    """Child chunk of a policy PDF — the retrieval unit (vector + full-text), see app/hrms_chunking/."""
    __tablename__ = "hrms_chunks"
    __table_args__ = (
        Index("ix_hrms_chunks_tsv", "tsv", postgresql_using="gin"),
        Index("ix_hrms_chunks_meta", "meta", postgresql_using="gin"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    doc_id: Mapped[str] = mapped_column(String(220), unique=True)
    parent_id: Mapped[str] = mapped_column(ForeignKey("hrms_parents.parent_id", ondelete="CASCADE"), index=True)
    doc: Mapped[str] = mapped_column(String(100), index=True)
    doc_type: Mapped[str] = mapped_column(String(32))
    element_type: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    embed_text: Mapped[str] = mapped_column(Text)
    embed_only: Mapped[bool] = mapped_column(Boolean, default=False)  # e.g. FAQ question-only vector
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBED_DIM))
    tsv = mapped_column(TSVECTOR, Computed("to_tsvector('english', embed_text)", persisted=True))
    content_hash: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(100))


# Register employee models on Base.metadata (after Base is defined; avoids circular import)
from .models import employee  # noqa: E402,F401


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


def get_session() -> AsyncSession:
    return Session()
