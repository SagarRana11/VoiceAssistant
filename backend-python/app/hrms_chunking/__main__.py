"""python -m app.hrms_chunking [--dump] [slug-substring] — chunk stats, samples and size-rule check."""
import random
import sys

from . import load_hrms_chunks
from .strategies import CHILD_MAX, CHILD_MIN, tok
from .types import ChildRow

args = [a for a in sys.argv[1:] if not a.startswith("--")]
parents, children = load_hrms_chunks()
if args:
    children = [c for c in children if args[0] in c["doc"]]
    for c in children:
        print(f"--- {c['doc_id']} [{c['element_type']}] {c['meta'].get('country', '')}\n{c['embed_text']}\n")
    sys.exit()

sizes = [tok(c["embed_text"]) for c in children]
print(f"\n{len(parents)} parents, {len(children)} children; child tokens min {min(sizes)} "
      f"median {sorted(sizes)[len(sizes) // 2]} max {max(sizes)}")
per_parent: dict[str, int] = {}
for c in children:
    per_parent[c["parent_id"]] = per_parent.get(c["parent_id"], 0) + (not c["embed_only"])
# a lone child of a tiny parent (e.g. a 1-line revision history) has nothing to merge into → allowed
bad = [c for c in children if not c["embed_only"] and (tok(c["embed_text"]) > CHILD_MAX or
       tok(c["embed_text"]) < CHILD_MIN and per_parent[c["parent_id"]] > 1)]
for c in bad:
    print(f"SIZE VIOLATION {tok(c['embed_text'])} tok: {c['doc_id']}: {c['content'][:80]}")
if "--dump" in sys.argv:
    random.seed(1)
    by_type: dict[str, list[ChildRow]] = {}
    for c in children:
        by_type.setdefault(c["doc_type"], []).append(c)
    for t, cs in by_type.items():
        for c in random.sample(cs, min(2, len(cs))):
            print(f"\n=== {t} :: {c['doc_id']} [{c['element_type']}]\n{c['embed_text']}")
sys.exit(1 if bad else 0)
