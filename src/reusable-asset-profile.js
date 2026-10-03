import { CatalogError } from './catalog.js';

export const FIVE_V_LEVELS = Object.freeze(['Part', 'Feature', 'Component', 'System', 'Application System']);
const FIVE_V_RANK = new Map(FIVE_V_LEVELS.map((level, index) => [level, index]));

function uniqueStrings(values, field) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new CatalogError(`${field} must be a string array.`, 'INVALID_REUSABLE_ASSET_PROFILE');
  }
  return [...new Set(values.map((value) => value.trim()))];
}

function normalizeAssetTypes(meta, classification) {
  if (meta.reusableAssetTypes != null) {
    const explicit = uniqueStrings(meta.reusableAssetTypes, 'meta.reusableAssetTypes');
    if (explicit.length === 0) throw new CatalogError('meta.reusableAssetTypes must not be empty when provided.', 'INVALID_REUSABLE_ASSET_PROFILE');
    return { values: explicit, mode: 'canonical', source: 'meta.reusableAssetTypes' };
  }
  if (classification.value !== 'unknown') {
    return { values: [classification.value], mode: classification.mode, source: classification.source };
  }
  return { values: [], mode: 'not-recorded', source: 'no explicit reusable asset type' };
}

function normalizeFiveV(meta, assetTypes, evidence) {
  if (meta.fiveV == null) {
    return {
      value: {
        status: 'not_recorded',
        applicable: null,
        level: null,
        composed_from: [],
        verification_basis: []
      },
      mode: 'not-recorded',
      source: 'meta.fiveV is not recorded'
    };
  }
  if (!meta.fiveV || typeof meta.fiveV !== 'object' || Array.isArray(meta.fiveV)) {
    throw new CatalogError('meta.fiveV must be an object when provided.', 'INVALID_FIVE_V_PROFILE');
  }
  const allowed = new Set(['applicable', 'level', 'composedFrom', 'verificationBasis']);
  const unexpected = Object.keys(meta.fiveV).filter((key) => !allowed.has(key));
  if (unexpected.length) throw new CatalogError(`meta.fiveV contains unsupported fields: ${unexpected.join(', ')}`, 'INVALID_FIVE_V_PROFILE');
  if (typeof meta.fiveV.applicable !== 'boolean') {
    throw new CatalogError('meta.fiveV.applicable must be boolean.', 'INVALID_FIVE_V_PROFILE');
  }
  const composedFrom = uniqueStrings(meta.fiveV.composedFrom ?? [], 'meta.fiveV.composedFrom');
  const verificationBasis = uniqueStrings(meta.fiveV.verificationBasis ?? [], 'meta.fiveV.verificationBasis');

  if (meta.fiveV.applicable === false) {
    if (meta.fiveV.level != null || composedFrom.length > 0) {
      throw new CatalogError('A non-applicable 5V profile cannot declare a level or composedFrom.', 'INVALID_FIVE_V_PROFILE');
    }
    return {
      value: {
        status: 'not_applicable',
        applicable: false,
        level: null,
        composed_from: [],
        verification_basis: verificationBasis
      },
      mode: 'canonical',
      source: 'meta.fiveV'
    };
  }

  if (!assetTypes.includes('code')) {
    throw new CatalogError('5V applicability requires reusableAssetTypes to include code.', 'FIVE_V_REQUIRES_CODE_TYPE');
  }
  if (!FIVE_V_RANK.has(meta.fiveV.level)) {
    throw new CatalogError('meta.fiveV.level must be one verified 5V level.', 'INVALID_FIVE_V_LEVEL');
  }
  if (verificationBasis.length === 0) {
    throw new CatalogError('Applicable 5V assets must record verificationBasis.', 'FIVE_V_VERIFICATION_BASIS_REQUIRED');
  }
  if (evidence?.normal?.passed !== true || evidence?.user?.passed !== true) {
    throw new CatalogError('Applicable 5V assets require normal and user verification evidence.', 'FIVE_V_ASSET_UNVERIFIED');
  }
  return {
    value: {
      status: 'verified',
      applicable: true,
      level: meta.fiveV.level,
      composed_from: composedFrom,
      verification_basis: verificationBasis
    },
    mode: 'canonical',
    source: 'meta.fiveV'
  };
}

export function buildReusableAssetProfile({ meta, classification, evidence }) {
  const assetTypes = normalizeAssetTypes(meta, classification);
  const fiveV = normalizeFiveV(meta, assetTypes.values, evidence);
  return Object.freeze({
    value: {
      asset_types: assetTypes.values,
      primary_type: classification.value,
      five_v: fiveV.value
    },
    derivation: [
      { field: 'reusability.asset_types', type: assetTypes.mode, source: assetTypes.source, verified: assetTypes.mode === 'canonical' },
      { field: 'reusability.five_v', type: fiveV.mode, source: fiveV.source, verified: fiveV.mode === 'canonical' }
    ]
  });
}

export function assertFiveVComposition(records) {
  const byId = new Map(records.map((record) => [record.asset.identity.asset_id, record.asset]));
  let verifiedFiveVCount = 0;
  let composedEdgeCount = 0;
  for (const record of records) {
    const asset = record.asset;
    const fiveV = asset.reusability?.five_v;
    if (fiveV?.status !== 'verified') continue;
    verifiedFiveVCount += 1;
    const parentId = asset.identity.asset_id;
    const parentRank = FIVE_V_RANK.get(fiveV.level);
    if (fiveV.level === 'Part' && fiveV.composed_from.length > 0) {
      throw new CatalogError(`5V Part ${parentId} cannot be composed from lower 5V assets.`, 'INVALID_FIVE_V_COMPOSITION');
    }
    if (fiveV.level !== 'Part' && fiveV.composed_from.length === 0) {
      throw new CatalogError(`5V ${fiveV.level} ${parentId} must record direct composed_from assets.`, 'FIVE_V_COMPOSITION_REQUIRED');
    }
    for (const childId of fiveV.composed_from) {
      composedEdgeCount += 1;
      if (childId === parentId) throw new CatalogError(`5V asset ${parentId} cannot compose itself.`, 'FIVE_V_SELF_REFERENCE');
      const child = byId.get(childId);
      if (!child) throw new CatalogError(`5V asset ${parentId} references unknown child ${childId}.`, 'FIVE_V_CHILD_NOT_FOUND');
      const childFiveV = child.reusability?.five_v;
      if (childFiveV?.status !== 'verified') {
        throw new CatalogError(`5V asset ${parentId} requires verified 5V child ${childId}.`, 'FIVE_V_CHILD_UNVERIFIED');
      }
      const childRank = FIVE_V_RANK.get(childFiveV.level);
      if (!(childRank < parentRank)) {
        throw new CatalogError(`5V asset ${parentId} cannot compose same/higher level child ${childId}.`, 'FIVE_V_LEVEL_ORDER_INVALID');
      }
    }
  }
  return Object.freeze({ verifiedFiveVCount, composedEdgeCount });
}
