import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eventMetadataDescription, fighterMetadataDescription, organizationMetadataDescription, truncateDescription } from './seo-utils';

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
