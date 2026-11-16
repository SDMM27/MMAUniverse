// data/scrapers/sync-fighter-photos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateWikidataRows,
  mapWikiPageImages,
  matchFighters,
  parseArticleUrl,
  parseArtist,
  pickKnownFile,
  toIsoDay,
  type OurFighter,
  type WikidataItem,
} from './sync-fighter-photos';

function item(partial: Partial<WikidataItem> & { qid: string }): WikidataItem {
  return { sherdogIds: new Set(), files: [], birthDate: null, names: new Set(), articles: [], ...partial };
}

function fighter(id: number, name: string, extra: Partial<OurFighter> = {}): OurFighter {
  return { id, name, sherdog_url: null, birth_date: null, ...extra };
}

test('matches by Sherdog ID', () => {
  const items = [item({ qid: 'Q1', sherdogIds: new Set(['123']), files: ['A.jpg'] })];
  const m = matchFighters([fighter(1, 'Whoever', { sherdog_url: 'https://www.sherdog.com/fighter/Some-Name-123' })], items);
  assert.equal(m.get(1)?.item.qid, 'Q1');
  assert.equal(m.get(1)?.method, 'sherdog');
});

test('several items on one Sherdog ID: the first with a photo wins', () => {
  const items = [
    item({ qid: 'Q1', sherdogIds: new Set(['123']) }),
    item({ qid: 'Q2', sherdogIds: new Set(['123']), files: ['A.jpg'] }),
  ];
  const m = matchFighters([fighter(1, 'X', { sherdog_url: 'https://www.sherdog.com/fighter/X-123' })], items);
  assert.equal(m.get(1)?.item.qid, 'Q2');
});

test('matches by name + birth date despite accents and case', () => {
  const items = [item({ qid: 'Q1', names: new Set(['uros medic']), birthDate: '1990-05-04' })];
  const m = matchFighters([fighter(1, 'UROŠ Medić', { birth_date: '1990-05-04' })], items);
  assert.equal(m.get(1)?.item.qid, 'Q1');
  assert.equal(m.get(1)?.method, 'name+dob');
});

test('accepts a Date birth_date (read in UTC)', () => {
  assert.equal(toIsoDay(new Date('1990-05-04T00:00:00Z')), '1990-05-04');
  assert.equal(toIsoDay('1990-05-04T00:00:00.000Z'), '1990-05-04');
  assert.equal(toIsoDay(null), null);
});

test('never matches on name alone', () => {
  const items = [item({ qid: 'Q1', names: new Set(['ian garry']), birthDate: '1997-08-26' })];
  assert.equal(matchFighters([fighter(1, 'Ian Garry')], items).size, 0);
  assert.equal(matchFighters([fighter(1, 'Ian Garry', { birth_date: '1997-08-27' })], items).size, 0);
  // an item without a (single) birth date can't match either
  const noDob = [item({ qid: 'Q1', names: new Set(['ian garry']) })];
  assert.equal(matchFighters([fighter(1, 'Ian Garry', { birth_date: '1997-08-26' })], noDob).size, 0);
});

test('rejects ambiguity: two items with the same name + date', () => {
  const items = [
    item({ qid: 'Q1', names: new Set(['john smith']), birthDate: '1990-01-01' }),
    item({ qid: 'Q2', names: new Set(['john smith']), birthDate: '1990-01-01' }),
  ];
  assert.equal(matchFighters([fighter(1, 'John Smith', { birth_date: '1990-01-01' })], items).size, 0);
});

test('rejects ambiguity: two of our fighters with the same name + date', () => {
  const items = [item({ qid: 'Q1', names: new Set(['john smith']), birthDate: '1990-01-01' })];
  const m = matchFighters(
    [fighter(1, 'John Smith', { birth_date: '1990-01-01' }), fighter(2, 'john smith', { birth_date: '1990-01-01' })],
    items,
  );
  assert.equal(m.size, 0);
});

test('rejects an item whose Sherdog ID differs from the fighter\'s', () => {
  const items = [item({ qid: 'Q1', sherdogIds: new Set(['999']), names: new Set(['john smith']), birthDate: '1990-01-01' })];
  const m = matchFighters(
    [fighter(1, 'John Smith', { birth_date: '1990-01-01', sherdog_url: 'https://www.sherdog.com/fighter/John-Smith-111' })],
    items,
  );
  assert.equal(m.size, 0);
});

test('name + date fallback accepts an item without Sherdog ID, or with the same one', () => {
  const items = [item({ qid: 'Q1', sherdogIds: new Set(['111']), names: new Set(['john smith']), birthDate: '1990-01-01' })];
  // same Sherdog ID would already match in step 1, so method is sherdog
  const m = matchFighters(
    [fighter(1, 'John Smith', { birth_date: '1990-01-01', sherdog_url: 'https://www.sherdog.com/fighter/John-Smith-111' })],
    items,
  );
  assert.equal(m.get(1)?.method, 'sherdog');
  const noSherdog = [item({ qid: 'Q2', names: new Set(['john smith']), birthDate: '1990-01-01' })];
  const m2 = matchFighters(
    [fighter(1, 'John Smith', { birth_date: '1990-01-01', sherdog_url: 'https://www.sherdog.com/fighter/John-Smith-111' })],
    noSherdog,
  );
  assert.equal(m2.get(1)?.method, 'name+dob');
});

test('an item is matched to at most one fighter', () => {
  const items = [item({ qid: 'Q1', sherdogIds: new Set(['123']), names: new Set(['john smith']), birthDate: '1990-01-01' })];
  const m = matchFighters(
    [
      fighter(1, 'A', { sherdog_url: 'https://www.sherdog.com/fighter/A-123' }),
      fighter(2, 'John Smith', { birth_date: '1990-01-01' }),
    ],
    items,
  );
  assert.equal(m.size, 1);
  assert.equal(m.get(1)?.method, 'sherdog');
});

test('parseArtist still extracts text and link', () => {
  const r = parseArtist('<a href="//commons.wikimedia.org/wiki/User:Foo">Foo</a> (<a href="/x">talk</a>)');
  assert.equal(r.author, 'Foo');
  assert.equal(r.authorUrl, 'https://commons.wikimedia.org/wiki/User:Foo');
});

test('parseArticleUrl decodes the title', () => {
  assert.deepEqual(parseArticleUrl('https://fr.wikipedia.org/wiki/Fran%C3%A7ois_Ngannou'), { lang: 'fr', title: 'François Ngannou' });
  assert.equal(parseArticleUrl('https://example.org/wiki/X'), null);
});

test('aggregateWikidataRows folds rows per item', () => {
  const q = (id: string) => ({ value: `http://www.wikidata.org/entity/${id}` });
  const rows = [
    {
      f: q('Q1'),
      sherdog: { value: '123' },
      img: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Foo%20Bar.jpg' },
      dob: { value: '1990-05-04T00:00:00Z' },
      name: { value: 'Uroš Medić' },
      article: { value: 'https://en.wikipedia.org/wiki/Uro%C5%A1_Medi%C4%87' },
    },
    {
      f: q('Q1'),
      sherdog: { value: '123' },
      img: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Second.jpg' },
      dob: { value: '1990-05-04T00:00:00Z' },
      name: { value: 'Uros Medic' },
    },
    { f: q('Q2'), dob: { value: '1990-01-01T00:00:00Z' } },
    { f: q('Q2'), dob: { value: '1990-01-02T00:00:00Z' } },
  ];
  const [a, b] = aggregateWikidataRows(rows);
  assert.deepEqual(a.files, ['Foo Bar.jpg', 'Second.jpg']);
  assert.deepEqual(Array.from(a.sherdogIds), ['123']);
  assert.equal(a.birthDate, '1990-05-04');
  assert.deepEqual(Array.from(a.names), ['uros medic']);
  assert.deepEqual(a.articles, [{ lang: 'en', title: 'Uroš Medić' }]);
  assert.equal(b.birthDate, null); // two distinct days: not trusted
});

test('mapWikiPageImages follows normalized and redirects, ignores pages without a free image', () => {
  const data = {
    query: {
      normalized: [{ from: 'foo bar', to: 'Foo bar' }],
      redirects: [{ from: 'Old name', to: 'New name' }],
      pages: [
        { title: 'Foo bar', pageprops: { page_image_free: 'Foo.jpg' } },
        { title: 'New name', pageprops: { page_image_free: 'New.jpg' } },
        { title: 'None' },
      ],
    },
  };
  const m = mapWikiPageImages(data, ['foo bar', 'Old name', 'None', 'Missing']);
  assert.equal(m.get('foo bar'), 'Foo.jpg');
  assert.equal(m.get('Old name'), 'New.jpg');
  assert.equal(m.has('None'), false);
  assert.equal(m.has('Missing'), false);
});

test('pickKnownFile: override beats P18, null override blocks, no P18 defers to Wikipedia', () => {
  const withP18 = item({ qid: 'Q1', files: ['Wikidata.jpg'] });
  assert.equal(pickKnownFile(['186873'], withP18).file, 'PetrYan (cropped).jpg');
  assert.equal(pickKnownFile(['186873'], withP18).source, 'override');
  assert.deepEqual(pickKnownFile(['1'], withP18), { file: 'Wikidata.jpg', source: 'P18', final: true });
  assert.equal(pickKnownFile(['1'], item({ qid: 'Q2' })).final, false);
});
