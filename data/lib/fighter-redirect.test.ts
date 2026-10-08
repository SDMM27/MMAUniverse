import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { legacyFighterIdFromPath } from './fighter-redirect';

describe('legacyFighterIdFromPath', () => {
  it('matches numeric fighter paths, with or without trailing slash', () => {
    assert.equal(legacyFighterIdFromPath('/fighters/11'), 11);
    assert.equal(legacyFighterIdFromPath('/fighters/11/'), 11);
    assert.equal(legacyFighterIdFromPath('/fighters/123456789'), 123456789);
  });
  it('ignores everything else', () => {
    for (const p of ['/fighters/1234567890', '/fighters/islam-makhachev', '/fighters/11/extra', '/fighters', '/fighters/', '/events/11', '/fighters/1a', '/x/fighters/11']) {
      assert.equal(legacyFighterIdFromPath(p), null, p);
    }
  });
});
