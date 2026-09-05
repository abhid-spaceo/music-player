import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyLimit, ptDate } from '../lib/youtube/quota-date';

// --- ptDate: UTC → Pacific calendar date, DST included -------------------

test('ptDate: winter (PST, UTC-8) rolls the day at 08:00 UTC', () => {
  // 07:59Z is still the previous PT day; 08:01Z is the new PT day.
  assert.equal(ptDate(new Date('2026-01-15T07:59:00Z')), '2026-01-14');
  assert.equal(ptDate(new Date('2026-01-15T08:01:00Z')), '2026-01-15');
});

test('ptDate: summer (PDT, UTC-7) rolls the day at 07:00 UTC', () => {
  assert.equal(ptDate(new Date('2026-07-15T06:59:00Z')), '2026-07-14');
  assert.equal(ptDate(new Date('2026-07-15T07:01:00Z')), '2026-07-15');
});

test('ptDate: midday UTC is the same PT day', () => {
  assert.equal(ptDate(new Date('2026-03-10T18:00:00Z')), '2026-03-10');
});

// --- dailyLimit: env override with a safe default ------------------------

test('dailyLimit defaults to 10000 when unset or invalid', () => {
  const prev = process.env.YOUTUBE_DAILY_QUOTA;
  delete process.env.YOUTUBE_DAILY_QUOTA;
  assert.equal(dailyLimit(), 10_000);
  process.env.YOUTUBE_DAILY_QUOTA = 'not-a-number';
  assert.equal(dailyLimit(), 10_000);
  if (prev === undefined) delete process.env.YOUTUBE_DAILY_QUOTA;
  else process.env.YOUTUBE_DAILY_QUOTA = prev;
});

test('dailyLimit honours a positive override', () => {
  const prev = process.env.YOUTUBE_DAILY_QUOTA;
  process.env.YOUTUBE_DAILY_QUOTA = '50000';
  assert.equal(dailyLimit(), 50_000);
  if (prev === undefined) delete process.env.YOUTUBE_DAILY_QUOTA;
  else process.env.YOUTUBE_DAILY_QUOTA = prev;
});
