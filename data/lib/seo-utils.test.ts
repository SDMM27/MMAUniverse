import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eventMetadataDescription, fighterMetadataDescription, listingCanonical, organizationMetadataDescription, staticPageMetadata, truncateDescription } from './seo-utils';

describe('truncateDescription', () => {
  it('leaves short text alone and cuts long text with an ellipsis', () => {
    assert.equal(truncateDescription('  court   texte '), 'court texte');
    const out = truncateDescription('mot '.repeat(100), 50);
    assert.ok(out.length <= 50);
    assert.ok(out.endsWith('…'));
  });
});

describe('fighterMetadataDescription', () => {
  it('includes organisation, division, record and FightScore', () => {
    const text = fighterMetadataDescription(
      { name: 'Islam Makhachev', weight_class: 'Lightweight', record: '27-1-0', organization_abbreviation: 'UFC' },
      { display_score: '98.24' },
    );
    assert.match(text, /Islam Makhachev \(UFC, Lightweight\)/);
    assert.match(text, /Bilan : 27-1-0/);
    assert.match(text, /FightScore : 98\.2\/100/);
  });

  it('degrades without optional data', () => {
    assert.match(fighterMetadataDescription({ name: 'X' }), /^X\. Historique/);
  });
});

describe('eventMetadataDescription', () => {
  it('formats the date in French and names the main event', () => {
    const text = eventMetadataDescription(
      { name: 'UFC 331 - Van vs. Pantoja 2', date: '2026-10-10', event_location: 'Las Vegas' },
      { fighter1: { name: 'A' }, fighter2: { name: 'B' } },
    );
    assert.match(text, /10 oct\. 2026/);
    assert.match(text, /Main event : A vs B/);
  });

  it('works without a main event', () => {
    assert.doesNotMatch(eventMetadataDescription({ name: 'E', date: '2026-10-10' }), /Main event/);
  });
});

describe('organizationMetadataDescription', () => {
  it('mentions name and abbreviation', () => {
    assert.match(organizationMetadataDescription({ name: 'Ultimate Fighting Championship', abbreviation: 'UFC' }), /\(UFC\)/);
  });
});

describe('listingCanonical', () => {
  it('keeps the organisation filter and a page past the first', () => {
    assert.equal(listingCanonical('/fighters', {}), '/fighters');
    assert.equal(listingCanonical('/fighters', { org: 'all', page: '1' }), '/fighters');
    assert.equal(listingCanonical('/fighters', { org: '3', page: '2' }), '/fighters?org=3&page=2');
  });

  it('drops junk values', () => {
    assert.equal(listingCanonical('/actualites', { org: 'abc', page: '-4' }), '/actualites');
    assert.equal(listingCanonical('/actualites', { page: '2.5' }), '/actualites');
  });
});

describe('staticPageMetadata', () => {
  it('sets the canonical and a share block carrying the default image', () => {
    const metadata = staticPageMetadata({ title: 'Événements MMA', description: 'd', path: '/events' });
    assert.equal(metadata.alternates.canonical, '/events');
    assert.equal(metadata.openGraph.url, '/events');
    assert.equal(metadata.openGraph.siteName, 'MMA Universe');
    assert.equal(metadata.openGraph.images[0].url, '/opengraph-image.png');
  });
});
