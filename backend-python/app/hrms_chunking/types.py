"""Typed shapes flowing through the HRMS chunking pipeline (PDF lines → elements → parents/children → DB rows)."""
from collections.abc import Callable
from typing import Literal, NotRequired, TypedDict

DocType = Literal["handbook", "legal", "matrix", "reference", "faq", "sheet", "slides", "checklist", "memo"]
HeadingLevel = Literal[1, 2, 3]


class RawLine(TypedDict):
    """One positioned text line from the pypdf visitor."""

    page: int
    x: int
    y: int
    size: float
    text: str
    w: float
    bold: bool
    oblique: bool
    col: NotRequired[int]  # set only for two-column layouts


class HeadingEl(TypedDict):
    type: Literal["heading"]
    level: HeadingLevel
    text: str
    page: int


class ParaEl(TypedDict):
    type: Literal["para"]
    text: str
    page: int


class TableEl(TypedDict):
    type: Literal["table"]
    rows: list[list[str]]
    page: int


Element = HeadingEl | ParaEl | TableEl


class ChildSpec(TypedDict):
    """Retrieval unit produced by a strategy (before size rules / metadata)."""

    text: str
    element_type: str
    embed_only: NotRequired[bool]


# memo header table ("To", "From", "Date", "Re") → lower-cased meta keys; "from" is a keyword → functional syntax
MemoMeta = TypedDict("MemoMeta", {"to": str, "from": str, "date": str, "re": str}, total=False)


class ParentSpec(TypedDict):
    key: str
    section: list[str]
    content: str
    children: list[ChildSpec]
    _meta: NotRequired[MemoMeta]


class EntityMeta(TypedDict, total=False):
    country: list[str]
    location: list[str]
    level: list[str]
    leave_type: list[str]


ChildMeta = TypedDict(
    "ChildMeta",
    {
        "doc": str,
        "doc_title": str,
        "doc_type": DocType,
        "section_path": list[str],
        "element_type": str,
        "version": str,
        "effective_date": str,
        "ordinal": int,
        "country": NotRequired[list[str]],
        "location": NotRequired[list[str]],
        "level": NotRequired[list[str]],
        "leave_type": NotRequired[list[str]],
        "to": NotRequired[str],
        "from": NotRequired[str],
        "date": NotRequired[str],
        "re": NotRequired[str],
    },
)


class IngestedMeta(ChildMeta):
    llm_context: NotRequired[str]  # added by ingest.sync_hrms when HRMS_LLM_CONTEXT=1


class ParentRow(TypedDict):
    parent_id: str
    doc: str
    title: str
    content: str


class ChildRow(TypedDict):
    doc_id: str
    parent_id: str
    doc: str
    doc_type: DocType
    element_type: str
    content: str
    embed_text: str
    embed_only: bool
    meta: ChildMeta


Strategy = Callable[[list[Element]], list[ParentSpec]]
