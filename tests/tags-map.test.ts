import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupTags } from '../lib/library/tags';

test('groups tag rows by kind into name arrays', () => {
  const rows = [
    { kind: 'mood', name: 'Romantic' },
    { kind: 'genre', name: 'Bollywood' },
    { kind: 'mood', name: 'Retro' },
  ] as const;
  assert.deepEqual(groupTags(rows), { moods: ['Romantic', 'Retro'], genres: ['Bollywood'] });
});
test('empty rows yield empty arrays', () => {
  assert.deepEqual(groupTags([]), { moods: [], genres: [] });
});
