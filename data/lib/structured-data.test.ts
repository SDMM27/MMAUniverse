import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { breadcrumbJsonLd, fighterProfileJsonLd, serializeJsonLd, sportsEventJsonLd, sportsOrganizationJsonLd } from './structured-data';

const BASE = 'https://example.com';

describe('breadcrumbJsonLd', () => {
  it('starts at the home page and numbers absolute items', () => {
    const data = breadcrumbJsonLd(BASE, [['Combattants', '/fighters']]) as { itemListElement: Array<{ position: number; item: string }> };
    assert.deepEqual(
      data.itemListElement.map((item) => [item.position, item.item]),
      [[1, 'https://example.com/'], [2, 'https://example.com/fighters']],
    );
  });
});

describe('sportsEventJsonLd', () => {
  const event = {
    id: 12,
    name: 'UFC 300: Pereira vs. Hill',
    date: '2024-04-13',
    start_time: null,
    main_card_start: '2024-04-14T02:00:00Z',
    event_location: 'T-Mobile Arena, Las Vegas',
    event_poster: '',
    organization_id: 1,
    organization_abbreviation: 'UFC',
  };

  it('uses the precise start, links the organiser and dedupes competitors', () => {
    const fighter = { id: 5, name: 'Alex Pereira' };
    const data = sportsEventJsonLd(BASE, event, [{ fighter1: fighter, fighter2: { id: 6, name: 'Jamahal Hill' } }, { fighter1: fighter, fighter2: null }], 'd');
    assert.equal(data.startDate, '2024-04-14T02:00:00.000Z');
    assert.deepEqual(data.organizer, { '@type': 'SportsOrganization', name: 'UFC', url: 'https://example.com/organizations/1' });
    assert.equal((data.competitor as unknown[]).length, 2);
    assert.equal(data.image, undefined); // no usable poster
  });

  it('falls back to the calendar day, also past a midnight-UTC placeholder time', () => {
    const data = sportsEventJsonLd(BASE, { ...event, main_card_start: null, start_time: '2024-04-13T00:00:00Z' }, [], 'd');
    assert.equal(data.startDate, '2024-04-13');
    assert.equal(data.competitor, undefined);
  });
});

describe('fighterProfileJsonLd', () => {
  it('describes the person behind the profile page, leaving out unknowns', () => {
    const data = fighterProfileJsonLd(
      BASE,
      { name: 'Islam Makhachev', image_url: 'https://www.sherdog.com/x.jpg', nationality: 'ru', height_cm: 178, birth_date: new Date(1991, 9, 27), is_women: null, organization_id: 1, organization_abbreviation: 'UFC' },
      '/fighters/islam-makhachev',
      'd',
    );
    const person = data.mainEntity as Record<string, unknown>;
    assert.equal(data['@type'], 'ProfilePage');
    assert.equal(person.url, 'https://example.com/fighters/islam-makhachev');
    assert.equal(person.birthDate, '1991-10-27');
    assert.deepEqual(person.nationality, { '@type': 'Country', name: 'RU' });
    assert.equal('gender' in person, false);
  });
});

describe('sportsOrganizationJsonLd', () => {
  it('only gives an alternate name when it differs', () => {
    assert.equal(sportsOrganizationJsonLd(BASE, { id: 1, name: 'UFC', abbreviation: 'UFC' }, 'd').alternateName, undefined);
    assert.equal(sportsOrganizationJsonLd(BASE, { id: 2, name: 'Professional Fighters League', abbreviation: 'PFL' }, 'd').alternateName, 'PFL');
  });
});

describe('serializeJsonLd', () => {
  it('cannot close the script tag', () => {
    assert.equal(serializeJsonLd({ name: '</script><b>' }).includes('<'), false);
  });
});
