import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fighterHref, isNumericSlug, slugify, SLUG_TRANSLATE_FROM, SLUG_TRANSLATE_TO, SLUG_TRANSLATE_DELETED_COUNT } from './slug';

describe('slugify', () => {
  it('lowercases and dashes spaces', () => {
    assert.equal(slugify('Islam Makhachev'), 'islam-makhachev');
  });

  it('strips accents', () => {
    assert.equal(slugify('Jiří Procházka'), 'jiri-prochazka');
    assert.equal(slugify('Alexandre Pantoja Ñ'), 'alexandre-pantoja-n');
    assert.equal(slugify('Łukasz Brzeski'), 'lukasz-brzeski');
    assert.equal(slugify('Błachowicz'), 'blachowicz');
  });

  it('drops apostrophes instead of splitting words', () => {
    assert.equal(slugify("Sean O'Malley"), 'sean-omalley');
    assert.equal(slugify('Sean O’Malley'), 'sean-omalley');
  });

  it('collapses punctuation and trims dashes', () => {
    assert.equal(slugify('  A.J. McKee '), 'a-j-mckee');
    assert.equal(slugify('Bruno Silva - Jr.'), 'bruno-silva-jr');
    assert.equal(slugify('---'), '');
  });

  it('returns an empty string for empty or non-Latin names', () => {
    assert.equal(slugify(''), '');
    assert.equal(slugify(null), '');
    assert.equal(slugify(undefined), '');
    assert.equal(slugify('魔裟斗'), '');
  });

  it('maps every character of the SQL translate() table like translate() does', () => {
    const from = Array.from(SLUG_TRANSLATE_FROM);
    const to = Array.from(SLUG_TRANSLATE_TO);
    assert.ok(from.length > to.length, 'apostrophes are the trailing, deleted characters');
    assert.equal(from.length - to.length, SLUG_TRANSLATE_DELETED_COUNT);
    from.forEach((char, index) => {
      const expected = index < to.length ? to[index] : '';
      assert.equal(slugify(`x${char}x`), `x${expected}x`, `character ${char}`);
    });
  });

  it('covers the accented Latin letters NFD can decompose', () => {
    for (const char of 'àéîõüçñšžřěňůýłøđ') {
      assert.match(slugify(char), /^[a-z]$/, char);
      assert.ok(SLUG_TRANSLATE_FROM.includes(char), char);
    }
    assert.equal(slugify('Nguyễn Trần'), 'nguyen-tran');
    assert.equal(slugify('e\u0301'), 'e'); // decomposed input
  });

  it('uses only ASCII letters in the translate() target', () => {
    assert.match(SLUG_TRANSLATE_TO, /^[a-z]+$/);
  });
});

describe('fighterHref', () => {
  it('uses the slug', () => {
    assert.equal(fighterHref({ id: 11, name: 'Islam Makhachev' }), '/fighters/islam-makhachev');
  });

  it('falls back to the id', () => {
    assert.equal(fighterHref({ id: 11, name: '' }), '/fighters/11');
    assert.equal(fighterHref({ id: 11, name: '魔裟斗' }), '/fighters/11');
    assert.equal(fighterHref({ id: 11 }), '/fighters/11');
    assert.equal(fighterHref({ id: '11', name: null }), '/fighters/11');
  });

  it('never emits a numeric slug (it would be read as an id)', () => {
    assert.equal(fighterHref({ id: 7, name: '50' }), '/fighters/7');
    assert.ok(isNumericSlug('50'));
    assert.ok(!isNumericSlug('a50'));
  });
});
