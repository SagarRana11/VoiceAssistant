/**
 * Tests for keywordSearch.ts (pure BM25, no embeddings / Mongo needed).
 *
 * Run with: npx tsx --test src/rag/keywordSearch.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bm25Index, tokenize } from './keywordSearch';
import { KnowledgeDoc } from './knowledgeSources/exerciseKnowledge';

const doc = (id: string, title: string, content: string, tags: string[] = []): KnowledgeDoc => ({
  id,
  category: 'test',
  title,
  content,
  tags,
});

const DOCS = [
  doc('squat', 'Squat Technique', 'Keep your chest up and knees tracking over toes.', ['legs']),
  doc('deload', 'Deload Week', 'Reduce volume by 40-50% every 4-6 weeks to recover.', ['recovery']),
  doc('cardio', 'Zone 2 Cardio', 'Steady low intensity cardio builds aerobic base.', ['endurance']),
];

test('tokenize lowercases, splits and drops stopwords / 1-char tokens', () => {
  assert.deepEqual(tokenize('What is a Deload-Week, 4 x?'), ['deload', 'week']);
});

test('exact term ranks its doc first', () => {
  const hits = new Bm25Index(DOCS).search('how to do a deload', 3);
  assert.equal(hits[0]?.id, 'deload');
  assert.equal(hits.length, 1);
});

test('title/tag match outranks content-only match', () => {
  const docs = [...DOCS, doc('note', 'Misc', 'some cardio mentioned once')];
  const hits = new Bm25Index(docs).search('cardio', 5);
  assert.deepEqual(
    hits.map(d => d.id),
    ['cardio', 'note'],
  );
});

test('no shared term → no results; empty index safe', () => {
  assert.deepEqual(new Bm25Index(DOCS).search('quantum physics', 5), []);
  assert.deepEqual(new Bm25Index([]).search('squat', 5), []);
});
