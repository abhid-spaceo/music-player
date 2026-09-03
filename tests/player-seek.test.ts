import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampSeconds, secondsFromRatio, nudge } from '../lib/player/seek';

test('clampSeconds keeps within [0,total]', () => {
  assert.equal(clampSeconds(-5, 100), 0);
  assert.equal(clampSeconds(150, 100), 100);
  assert.equal(clampSeconds(42, 100), 42);
});
test('secondsFromRatio maps 0..1 to seconds', () => {
  assert.equal(secondsFromRatio(0.5, 200), 100);
  assert.equal(secondsFromRatio(-1, 200), 0);
  assert.equal(secondsFromRatio(2, 200), 200);
});
test('nudge steps by delta and clamps', () => {
  assert.equal(nudge(10, 5, 100), 15);
  assert.equal(nudge(98, 5, 100), 100);
  assert.equal(nudge(2, -5, 100), 0);
});
