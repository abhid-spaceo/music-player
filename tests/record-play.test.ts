import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldRecordPlay } from '../lib/player/record-play';

test('records when the track id changes', () => {
  assert.equal(shouldRecordPlay(null, 't1'), true);
  assert.equal(shouldRecordPlay('t1', 't2'), true);
});
test('does not record the same track twice in a row', () => {
  assert.equal(shouldRecordPlay('t1', 't1'), false);
});
