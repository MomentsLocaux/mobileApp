import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMemberSearchOrFilter } from './member-place-search';

describe('buildMemberSearchOrFilter', () => {
  it('matches name, city and region/zone', () => {
    assert.equal(
      buildMemberSearchOrFilter('Nyons'),
      'display_name.ilike.%Nyons%,city.ilike.%Nyons%,region.ilike.%Nyons%',
    );
  });

  it('returns null for empty or wildcard-only input', () => {
    assert.equal(buildMemberSearchOrFilter('   '), null);
    assert.equal(buildMemberSearchOrFilter('%_%'), null);
  });
});
