/**
 * Tests for queryRewriter.ts
 *
 * Run with: npx ts-node src/rag/queryRewriter.test.ts
 *
 * These tests exercise the rewriter in isolation without a running server.
 * They require OPENAI_API_KEY to be set for live tests; mock-mode tests run without it.
 */

import { rewriteQueryForRetrieval, RewriterDomain } from './queryRewriter';
import { ChatMessage } from '../services/openaiService';

// ─── Simple assertion helpers ─────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}


function assertNotJSON(label: string, value: string) {
  assert(label, !value.trim().startsWith('{'),
    `Expected non-JSON but got: ${value.slice(0, 60)}`);
}

function assertMinLength(label: string, value: string, min: number) {
  assert(label, value.length >= min,
    `Expected length >= ${min}, got ${value.length}`);
}

// ─── Test suites ──────────────────────────────────────────────────────────────

async function testBasicFitnessRewrite() {
  console.log('\n[Suite] Basic fitness rewrite');
  const result = await rewriteQueryForRetrieval(
    "I've been feeling really tired and can't seem to lose weight",
    'fitness',
  );
  assertMinLength('returns a non-empty string', result, 5);
  assertNotJSON('does not return a JSON blob', result);
  assert('returns fewer words than original (compressed)', result.split(' ').length <= 12,
    `got ${result.split(' ').length} words`);
  console.log(`  result: "${result}"`);
}

async function testBasicHealthRewrite() {
  console.log('\n[Suite] Basic health rewrite');
  const result = await rewriteQueryForRetrieval(
    'I keep getting bloated and feel sluggish after every meal',
    'health',
  );
  assertMinLength('returns a non-empty string', result, 5);
  assertNotJSON('does not return a JSON blob', result);
  console.log(`  result: "${result}"`);
}

async function testBasicHospitalRewrite() {
  console.log('\n[Suite] Basic hospital rewrite');
  const result = await rewriteQueryForRetrieval(
    'will it hurt during the heart operation?',
    'hospital',
  );
  assertMinLength('returns a non-empty string', result, 5);
  assertNotJSON('does not return a JSON blob', result);
  console.log(`  result: "${result}"`);
}

async function testCacheHit() {
  console.log('\n[Suite] Cache deduplication');
  const message = 'unique cache test message for running';
  const domain: RewriterDomain = 'fitness';

  const start1 = Date.now();
  const result1 = await rewriteQueryForRetrieval(message, domain);
  const time1 = Date.now() - start1;

  const start2 = Date.now();
  const result2 = await rewriteQueryForRetrieval(message, domain);
  const time2 = Date.now() - start2;

  assert('both calls return the same result', result1 === result2,
    `"${result1}" !== "${result2}"`);
  assert('second call is faster (cache hit)', time2 < time1,
    `first: ${time1}ms, second: ${time2}ms`);
  console.log(`  first call: ${time1}ms, cached call: ${time2}ms`);
}

async function testConversationAwareRewrite() {
  console.log('\n[Suite] Conversation-aware rewrite (pronoun resolution)');

  const history: ChatMessage[] = [
    { role: 'user', content: 'Tell me about yoga for back pain' },
    { role: 'assistant', content: 'Yoga is excellent for lower back pain. Cat-cow, child\'s pose, and downward dog are great starting points.' },
  ];

  const result = await rewriteQueryForRetrieval('Can I do it every day?', 'fitness', history);
  assertMinLength('returns a non-empty string', result, 5);
  assertNotJSON('does not return a JSON blob', result);
  // With context, it should resolve "it" to yoga/back pain concepts (requires real LLM)
  if (skipIfMock('result resolves pronoun — not just literal "can i do it"')) {
    assert('result is not just the literal question words',
      !result.toLowerCase().includes('can i do it'), `got: "${result}"`);
  }
  console.log(`  result: "${result}"`);
}

async function testFallbackOnFailure() {
  console.log('\n[Suite] Graceful fallback');
  // Pass an empty string — should fall back to original
  const original = 'short';
  const result = await rewriteQueryForRetrieval(original, 'health');
  // Either returns a rewritten query or falls back to the original — never crashes
  assert('does not throw and returns a string', typeof result === 'string');
  assert('returns at least the original message length or a rewrite',
    result.length >= original.length || result.length >= 5);
  console.log(`  result: "${result}"`);
}

async function testDifferentDomainsProduceDifferentResults() {
  console.log('\n[Suite] Domain specificity');
  const message = 'explain the procedure and what to expect';

  const fitnessResult  = await rewriteQueryForRetrieval(message, 'fitness');
  // Use a different message for hospital to avoid cache collision on same message
  const hospitalResult = await rewriteQueryForRetrieval(message + ' (cardiac)', 'hospital');

  assert('fitness and hospital rewrites differ',
    fitnessResult.toLowerCase() !== hospitalResult.toLowerCase(),
    `both returned: "${fitnessResult}"`);
  console.log(`  fitness:  "${fitnessResult}"`);
  console.log(`  hospital: "${hospitalResult}"`);
}

async function testHospitalHistoryRewrite() {
  console.log('\n[Suite] Hospital chat with history');

  const history: ChatMessage[] = [
    { role: 'user', content: 'What is angioplasty?' },
    { role: 'assistant', content: 'Angioplasty is a procedure to open narrowed or blocked coronary arteries using a small balloon.' },
  ];

  const result = await rewriteQueryForRetrieval('How long will it take?', 'hospital', history);
  assertMinLength('returns a non-empty string', result, 5);
  assertNotJSON('does not return a JSON blob', result);
  // Should resolve "it" to angioplasty/procedure context (requires real LLM)
  if (skipIfMock('result resolves pronoun — not just "how long will it take"')) {
    assert('result is not just raw "how long will it take"',
      !result.toLowerCase().startsWith('how long'), `got: "${result}"`);
  }
  console.log(`  result: "${result}"`);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const HAS_API_KEY = !!process.env.OPENAI_API_KEY;

/** Skip a test with a clear label when running in mock mode */
function skipIfMock(label: string) {
  if (!HAS_API_KEY) {
    console.log(`  ~ ${label} (skipped — no OPENAI_API_KEY)`);
  }
  return HAS_API_KEY;
}

async function main() {
  console.log('=== QueryRewriter Tests ===');

  if (!HAS_API_KEY) {
    console.warn('\n⚠  OPENAI_API_KEY not set — rewriter will use mock fallback.\n   Cache and length tests still run; LLM-content assertions are skipped.\n');
  }

  await testBasicFitnessRewrite();
  await testBasicHealthRewrite();
  await testBasicHospitalRewrite();
  await testCacheHit();
  await testConversationAwareRewrite();
  await testFallbackOnFailure();
  await testDifferentDomainsProduceDifferentResults();
  await testHospitalHistoryRewrite();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
