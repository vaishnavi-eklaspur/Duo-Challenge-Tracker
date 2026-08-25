// Runs on Node's built-in test runner — no framework deps.
//   npm test   →   node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { possessive, plural, daysBetween, todayStr, computeCurrentDay, generateRoomId } from './lib.js';

test('possessive handles names ending in s vs not', () => {
  assert.equal(possessive('Amy'), "Amy's");
  assert.equal(possessive('Chris'), "Chris'");
  assert.equal(possessive(''), '');
});

test('plural picks singular only for exactly 1', () => {
  assert.equal(plural(1, 'day'), 'day');
  assert.equal(plural(0, 'day'), 'days');
  assert.equal(plural(3, 'day'), 'days');
  assert.equal(plural(2, 'perfect day', 'perfect days'), 'perfect days');
});

test('daysBetween counts calendar days and handles order/DST', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-01'), 0);
  assert.equal(daysBetween('2026-01-01', '2026-01-08'), 7);
  assert.equal(daysBetween('2026-01-08', '2026-01-01'), -7);
  // spans a spring-forward DST boundary in most US zones — must still be 30
  assert.equal(daysBetween('2026-03-01', '2026-03-31'), 30);
});

test('todayStr formats a fixed date as YYYY-MM-DD with zero-padding', () => {
  assert.equal(todayStr(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(todayStr(new Date(2026, 11, 25)), '2026-12-25');
});

test('computeCurrentDay is 1-indexed on the start date', () => {
  assert.equal(computeCurrentDay(todayStr()), 1);
});

test('generateRoomId returns a 6-char alphanumeric id', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(generateRoomId(), /^[A-Za-z0-9]{6}$/);
  }
});
