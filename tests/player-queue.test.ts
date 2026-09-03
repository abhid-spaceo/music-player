import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reorder, removeAt, indexAfterRemove } from '../lib/player/queue';

const q = (...xs: string[]) => xs;

test('reorder moves an item and preserves the rest', () => {
  assert.deepEqual(reorder(q('a', 'b', 'c', 'd'), 2, 0), q('c', 'a', 'b', 'd'));
});
test('reorder is a no-op for equal indices', () => {
  assert.deepEqual(reorder(q('a', 'b', 'c'), 1, 1), q('a', 'b', 'c'));
});
test('reorder ignores out-of-range indices', () => {
  assert.deepEqual(reorder(q('a', 'b'), 5, 0), q('a', 'b'));
});
test('removeAt drops the given index', () => {
  assert.deepEqual(removeAt(q('a', 'b', 'c'), 1), q('a', 'c'));
});
test('indexAfterRemove: removing before current shifts current down', () => {
  assert.equal(indexAfterRemove(3, 1), 2);
});
test('indexAfterRemove: removing after current keeps current', () => {
  assert.equal(indexAfterRemove(3, 5), 3);
});
test('indexAfterRemove: removing current keeps position (next song slides in)', () => {
  assert.equal(indexAfterRemove(3, 3), 3);
});
