// data/lib/flag-utils.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryCodeToFlag } from './flag-utils';

test('countryCodeToFlag converts an uppercase ISO code to its flag emoji', () => {
  assert.equal(countryCodeToFlag('FR'), '🇫🇷');
});

test('countryCodeToFlag normalizes a lowercase code', () => {
  assert.equal(countryCodeToFlag('br'), '🇧🇷');
});

test('countryCodeToFlag returns null for null input', () => {
  assert.equal(countryCodeToFlag(null), null);
});

test('countryCodeToFlag returns null for a malformed code', () => {
  assert.equal(countryCodeToFlag('FRA'), null);
  assert.equal(countryCodeToFlag('1'), null);
  assert.equal(countryCodeToFlag(''), null);
});
