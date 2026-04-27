import { DomainVectorStore } from './domainVectorStore';
import { loadHospitalKnowledgeDocs } from './knowledgeSources/hospitalKnowledge';
import { KnowledgeDoc } from './knowledgeSources/exerciseKnowledge';

let _store: DomainVectorStore | null = null;

function getHospitalStore(): DomainVectorStore {
  if (!_store) {
    const docs = loadHospitalKnowledgeDocs();
    _store = new DomainVectorStore('hospital', docs);
  }
  return _store;
}

function formatDoc(doc: KnowledgeDoc): string {
  return `### ${doc.title}\n${doc.content}`;
}

// Category sets for each query type
const CATEGORY_SETS: Record<string, string[]> = {
  disease:   ['disease'],
  consent:   ['consent', 'procedure'],
  procedure: ['procedure'],
  discharge: ['discharge', 'medicine'],
  medicine:  ['medicine'],
  hospital:  ['hospital'],
  all:       ['disease', 'consent', 'procedure', 'discharge', 'medicine', 'hospital'],
};

/**
 * Determine which category to search based on the query text.
 * Returns a category key from CATEGORY_SETS.
 */
export function classifyQueryCategory(query: string): string {
  const lower = query.toLowerCase();

  if (/\b(medicine|tablet|drug|aspirin|pill|dose|blood thinner|medication|warfarin|statin|beta blocker)\b/.test(lower))
    return 'medicine';

  if (/\b(discharge|recovery|home|walk|travel|activity|diet|wound|scar|rest|precaution|symptom after|return)\b/.test(lower))
    return 'discharge';

  if (/\b(consent|risk|benefit|side effect|alternative|permission|understand|agree|sign)\b/.test(lower))
    return 'consent';

  if (/\b(procedure|angiography|angioplasty|pci|stent|bypass|cabg|cath|operation|surgery)\b/.test(lower))
    return 'procedure';

  if (/\b(hospital|ward|icu|ccu|nurse|doctor|staff|process|admission|cath lab|room)\b/.test(lower))
    return 'hospital';

  if (/\b(what is|disease|attack|heart|nstemi|stemi|cad|diagnosis|condition|blockage|artery)\b/.test(lower))
    return 'disease';

  return 'all';
}

export async function retrieveHospitalDocs(
  query: string,
  categoryHint?: string,
  diagnosis?: string,
  topK = 3,
): Promise<string[]> {
  const store = getHospitalStore();
  await store.initialize();

  const category = categoryHint ?? classifyQueryCategory(query);
  const targetCategories = CATEGORY_SETS[category] ?? CATEGORY_SETS.all;

  // Build tags: category tags + diagnosis name for precise matching
  const tags = [...targetCategories, 'hospital_kb'];
  if (diagnosis) {
    tags.push(diagnosis.toLowerCase().replace(/\s+/g, '_'));
  }

  const docs = await store.searchByTags(tags, topK + 2);

  // Filter to target categories only
  const filtered = docs.filter(d => targetCategories.includes(d.category));

  // If not enough results, fall back to semantic search within category
  if (filtered.length < topK) {
    const semantic = await store.similaritySearch(query, topK + 2);
    const seen = new Set(filtered.map(d => d.id));
    for (const d of semantic) {
      if (!seen.has(d.id) && targetCategories.includes(d.category)) {
        filtered.push(d);
        seen.add(d.id);
        if (filtered.length >= topK) break;
      }
    }
  }

  return filtered.slice(0, topK).map(formatDoc);
}
