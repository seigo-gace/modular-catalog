import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFiveVComposition, buildReusableAssetProfile } from '../src/reusable-asset-profile.js';

function evidence() {
  return { normal: { passed: true }, user: { passed: true } };
}

function classification(value = 'unknown', mode = 'not-recorded', source = 'none') {
  return { value, mode, source };
}

function record(id, level, composedFrom = []) {
  return {
    asset: {
      identity: { asset_id: id },
      reusability: {
        asset_types: ['code'],
        primary_type: 'code',
        five_v: {
          status: 'verified',
          applicable: true,
          level,
          composed_from: composedFrom,
          verification_basis: ['evidence.json#/normal', 'evidence.json#/user']
        }
      }
    }
  };
}

test('legacy assets remain valid without inventing 5V data', () => {
  const profile = buildReusableAssetProfile({ meta: {}, classification: classification(), evidence: evidence() });
  assert.deepEqual(profile.value.asset_types, []);
  assert.equal(profile.value.primary_type, 'unknown');
  assert.deepEqual(profile.value.five_v, {
    status: 'not_recorded',
    applicable: null,
    level: null,
    composed_from: [],
    verification_basis: []
  });
  assert.equal(profile.derivation[1].type, 'not-recorded');
});

test('non-code reusable assets can be canonical without a 5V level', () => {
  const profile = buildReusableAssetProfile({
    meta: { reusableAssetTypes: ['skill', 'design'], fiveV: { applicable: false, verificationBasis: ['design.md'] } },
    classification: classification('skill', 'canonical', 'meta.assetKind'),
    evidence: evidence()
  });
  assert.deepEqual(profile.value.asset_types, ['skill', 'design']);
  assert.equal(profile.value.five_v.status, 'not_applicable');
  assert.equal(profile.value.five_v.level, null);
});

test('verified code can declare one 5V level and explicit verification basis', () => {
  const profile = buildReusableAssetProfile({
    meta: {
      reusableAssetTypes: ['tool', 'code'],
      fiveV: { applicable: true, level: 'Part', composedFrom: [], verificationBasis: ['tests/normal/tool.test.js', 'tests/user/tool.test.js'] }
    },
    classification: classification('tool', 'canonical', 'meta.assetKind'),
    evidence: evidence()
  });
  assert.deepEqual(profile.value.asset_types, ['tool', 'code']);
  assert.equal(profile.value.five_v.status, 'verified');
  assert.equal(profile.value.five_v.level, 'Part');
});

test('5V applicability cannot be assigned to an asset without the code type', () => {
  assert.throws(() => buildReusableAssetProfile({
    meta: {
      reusableAssetTypes: ['architecture'],
      fiveV: { applicable: true, level: 'Part', composedFrom: [], verificationBasis: ['architecture.md'] }
    },
    classification: classification('architecture', 'canonical', 'meta.assetKind'),
    evidence: evidence()
  }), (error) => error?.code === 'FIVE_V_REQUIRES_CODE_TYPE');
});

test('5V composition accepts direct lower verified code and rejects invalid lineage', () => {
  assert.deepEqual(assertFiveVComposition([
    record('part-a', 'Part'),
    record('feature-a', 'Feature', ['part-a']),
    record('component-a', 'Component', ['feature-a'])
  ]), { verifiedFiveVCount: 3, composedEdgeCount: 2 });

  assert.throws(() => assertFiveVComposition([
    record('part-a', 'Part'),
    record('feature-a', 'Feature', ['feature-a'])
  ]), (error) => error?.code === 'FIVE_V_SELF_REFERENCE');

  assert.throws(() => assertFiveVComposition([
    record('feature-a', 'Feature', ['missing-part'])
  ]), (error) => error?.code === 'FIVE_V_CHILD_NOT_FOUND');

  assert.throws(() => assertFiveVComposition([
    record('feature-a', 'Feature'),
    record('component-a', 'Component', ['feature-a']),
    record('feature-b', 'Feature', ['component-a'])
  ]), (error) => error?.code === 'FIVE_V_COMPOSITION_REQUIRED' || error?.code === 'FIVE_V_LEVEL_ORDER_INVALID');
});
