import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { CatalogError, sha256 } from './catalog.js';
import { assertReusableAssetSchema, createReusableAssetValidator } from './reusable-asset-schema.js';

const FORMAT = 'gace.reusable-asset.v1';
const CATALOG_REPOSITORY = 'seigo-gace/modular-catalog';
const REQUIRED_BUNDLE_FILES = ['asset.json', 'knowledge-units.jsonl', 'relationships.jsonl', 'cases.jsonl'];
const COMMIT_RE = /^[0-9a-f]{40}$/i;
const ASSET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function fail(message, code, details = null) {
  const error = new CatalogError(message, code);
  if (details !== null) error.details = details;
  throw error;
}

async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function assertDirectory(target, code = 'KB_DELIVERY_NOT_CONFIGURED') {
  const stat = await fs.stat(target).catch(() => null);
  if (!stat?.isDirectory()) fail(`Required directory is unavailable: ${target}`, code);
}

async function readJson(file, code = 'JSON_INVALID') {
  let value;
  try { value = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { fail(`JSON could not be read: ${file}: ${error.message}`, code); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`JSON object required: ${file}`, code);
  return value;
}

async function readJsonIfExists(file) {
  if (!await exists(file)) return null;
  return readJson(file, 'KB_STATE_INVALID');
}

async function readJsonl(file, emptyCode) {
  let text;
  try { text = await fs.readFile(file, 'utf8'); }
  catch (error) { fail(`JSONL could not be read: ${file}: ${error.message}`, 'BUNDLE_FILE_READ_FAILED'); }
  const rows = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    let value;
    try { value = JSON.parse(line); }
    catch (error) { fail(`JSONL parse failed: ${file}:${index + 1}: ${error.message}`, 'BUNDLE_JSONL_INVALID'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`JSONL object required: ${file}:${index + 1}`, 'BUNDLE_JSONL_INVALID');
    rows.push(value);
  }
  if (!rows.length) fail(`JSONL must not be empty: ${file}`, emptyCode);
  return rows;
}

async function assertNoSymlinks(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isSymbolicLink()) fail(`Symbolic link is not allowed in delivery: ${full}`, 'KB_DELIVERY_SYMLINK_REJECTED');
    if (entry.isDirectory()) await assertNoSymlinks(full);
  }
}

async function sha256File(file) {
  return sha256(await fs.readFile(file));
}

function assertTopManifest(manifest) {
  if (manifest.schema_version !== 1 || manifest.format !== FORMAT) fail('Top-level delivery manifest format is unsupported.', 'TOP_MANIFEST_FORMAT_UNSUPPORTED');
  if (!manifest.catalog || typeof manifest.catalog !== 'object' || Array.isArray(manifest.catalog)) fail('Top-level catalog provenance is missing.', 'TOP_MANIFEST_CATALOG_MISSING');
  if (manifest.catalog.repository !== CATALOG_REPOSITORY) fail('Top-level catalog repository mismatch.', 'TOP_MANIFEST_CATALOG_REPOSITORY_MISMATCH');
  if (!COMMIT_RE.test(String(manifest.catalog.commit ?? ''))) fail('Top-level catalog commit must be an exact 40-character Git SHA.', 'TOP_MANIFEST_CATALOG_COMMIT_INVALID');
  if (!Array.isArray(manifest.assets) || !manifest.assets.length) fail('Top-level delivery assets are empty.', 'TOP_MANIFEST_ASSETS_EMPTY');
  if (!Number.isSafeInteger(manifest.assetCount) || manifest.assetCount !== manifest.assets.length) fail('Top-level asset count mismatch.', 'TOP_MANIFEST_ASSET_COUNT_MISMATCH');
}

function assertAssetManifest(manifest, item, commit) {
  const assetId = item.id;
  if (manifest.schema_version !== 1 || manifest.format !== FORMAT) fail(`Bundle manifest format unsupported: ${assetId}`, 'BUNDLE_MANIFEST_FORMAT_UNSUPPORTED');
  if (manifest.algorithm !== 'sha256') fail(`Bundle manifest algorithm must be sha256: ${assetId}`, 'BUNDLE_MANIFEST_ALGORITHM_NOT_SHA256');
  if (manifest.asset_id !== assetId) fail(`Bundle asset id mismatch: ${assetId}`, 'BUNDLE_ASSET_ID_MISMATCH');
  const catalog = manifest.catalog;
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) fail(`Bundle catalog provenance missing: ${assetId}`, 'BUNDLE_CATALOG_PROVENANCE_MISSING');
  if (catalog.repository !== CATALOG_REPOSITORY) fail(`Bundle catalog repository mismatch: ${assetId}`, 'BUNDLE_CATALOG_REPOSITORY_MISMATCH');
  if (catalog.commit !== commit) fail(`Bundle catalog commit mismatch: ${assetId}`, 'BUNDLE_CATALOG_COMMIT_MISMATCH');
  if (catalog.asset_path !== `assets/${assetId}`) fail(`Bundle asset path mismatch: ${assetId}`, 'BUNDLE_CATALOG_ASSET_PATH_MISMATCH');
  if (manifest.source_asset_hash !== item.assetHash) fail(`Bundle source asset hash mismatch: ${assetId}`, 'BUNDLE_SOURCE_ASSET_HASH_MISMATCH');
  if (manifest.bundle_hash !== item.bundleHash) fail(`Bundle hash declaration mismatch: ${assetId}`, 'BUNDLE_HASH_DECLARATION_MISMATCH');
  if (!Array.isArray(manifest.files) || !manifest.files.length) fail(`Bundle manifest files missing: ${assetId}`, 'BUNDLE_MANIFEST_FILES_MISSING');
}

async function verifyManifestedFiles(assetDir, assetId, manifest, expectedBundleHash) {
  const listed = new Set();
  const normalizedFiles = [];
  const resolvedAssetDir = path.resolve(assetDir);
  for (const item of manifest.files) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`Bundle manifest file entry invalid: ${assetId}`, 'BUNDLE_MANIFEST_FILE_ENTRY_INVALID');
    const relative = String(item.path ?? '').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
    if (!relative) fail(`Bundle manifest path empty: ${assetId}`, 'BUNDLE_MANIFEST_PATH_EMPTY');
    if (listed.has(relative)) fail(`Bundle manifest duplicate path: ${assetId}:${relative}`, 'BUNDLE_MANIFEST_DUPLICATE_PATH');
    listed.add(relative);
    const file = path.resolve(assetDir, relative);
    const relCheck = path.relative(resolvedAssetDir, file);
    if (!relCheck || relCheck.startsWith('..') || path.isAbsolute(relCheck)) fail(`Bundle manifest path escape: ${assetId}:${relative}`, 'BUNDLE_MANIFEST_PATH_ESCAPE');
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) fail(`Bundle manifest file missing: ${assetId}:${relative}`, 'BUNDLE_MANIFEST_FILE_MISSING');
    if (!Number.isSafeInteger(item.size) || item.size < 0 || stat.size !== item.size) fail(`Bundle manifest size mismatch: ${assetId}:${relative}`, 'BUNDLE_MANIFEST_SIZE_MISMATCH');
    const actualHash = await sha256File(file);
    if (actualHash !== String(item.sha256 ?? '').toLowerCase()) fail(`Bundle manifest SHA-256 mismatch: ${assetId}:${relative}`, 'BUNDLE_MANIFEST_SHA256_MISMATCH');
    normalizedFiles.push({ path: relative, size: item.size, sha256: actualHash });
  }
  for (const required of REQUIRED_BUNDLE_FILES) {
    if (!listed.has(required)) fail(`Required bundle file is not manifested: ${assetId}:${required}`, 'BUNDLE_REQUIRED_FILE_NOT_MANIFESTED');
  }
  if (sha256(canonicalJson(normalizedFiles)) !== expectedBundleHash) fail(`Bundle hash mismatch: ${assetId}`, 'BUNDLE_HASH_MISMATCH');
}

function assertAssetIdentity(asset, assetId, commit) {
  if (asset.verification?.status !== 'verified') fail(`Asset is not verified: ${assetId}`, 'ASSET_NOT_VERIFIED');
  if (asset.identity?.asset_id !== assetId) fail(`Asset identity mismatch: ${assetId}`, 'ASSET_ID_MISMATCH');
  const catalog = asset.provenance?.catalog;
  if (!catalog || catalog.repository !== CATALOG_REPOSITORY || catalog.commit !== commit || catalog.asset_id !== assetId || catalog.asset_path !== `assets/${assetId}`) {
    fail(`Asset Catalog provenance mismatch: ${assetId}`, 'ASSET_CATALOG_PROVENANCE_MISMATCH');
  }
}

function assertDeclaredCount(value, label, assetId) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`Invalid ${label} count: ${assetId}`, 'DELIVERY_DECLARED_COUNT_INVALID');
}

export async function preflightDelivery(rootDir, deliveryRoot, { requireFullSnapshot = true } = {}) {
  const root = path.resolve(rootDir);
  const delivery = path.resolve(deliveryRoot);
  const topManifestPath = path.join(delivery, 'manifest.json');
  if (!await exists(topManifestPath)) fail(`Delivery manifest missing: ${topManifestPath}`, 'DELIVERY_MANIFEST_MISSING');
  await assertNoSymlinks(delivery);

  const manifest = await readJson(topManifestPath, 'TOP_MANIFEST_INVALID');
  assertTopManifest(manifest);
  const commit = manifest.catalog.commit;
  const assetIds = manifest.assets.map((item) => String(item?.id ?? ''));
  if (assetIds.some((id) => !id || !ASSET_ID_RE.test(id) || id === '.' || id === '..')) fail('Top-level asset id is invalid.', 'TOP_MANIFEST_ASSET_ID_INVALID');
  if (new Set(assetIds).size !== assetIds.length) fail('Top-level asset ids contain duplicates.', 'TOP_MANIFEST_ASSET_ID_DUPLICATE');

  const assetsRoot = path.join(delivery, 'assets');
  const actualDirs = (await fs.readdir(assetsRoot, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (JSON.stringify(actualDirs) !== JSON.stringify([...assetIds].sort())) fail('Delivery asset directory set does not match the top-level manifest.', 'EXPORT_ASSET_DIRECTORY_SET_MISMATCH');

  if (requireFullSnapshot) {
    const index = await readJson(path.join(root, 'catalog', 'index.json'), 'CATALOG_INDEX_INVALID');
    const expectedIds = Array.isArray(index.entries) ? index.entries.map((entry) => String(entry?.id ?? '')).sort() : [];
    if (index.assetCount !== assetIds.length || JSON.stringify(expectedIds) !== JSON.stringify([...assetIds].sort())) fail('KB activation delivery must represent the full current Catalog snapshot.', 'KB_DELIVERY_NOT_FULL_SNAPSHOT');
  }

  const validator = await createReusableAssetValidator(root);
  const allUnitIds = new Set();
  const allRelationshipIds = new Set();
  const relationships = [];
  let knowledgeUnitCount = 0;
  let relationshipCount = 0;
  let caseCount = 0;

  for (const item of manifest.assets) {
    const assetId = String(item.id);
    assertDeclaredCount(item.knowledgeUnits, 'Knowledge Unit', assetId);
    assertDeclaredCount(item.relationships, 'relationship', assetId);
    assertDeclaredCount(item.cases, 'case', assetId);
    const assetDir = path.join(assetsRoot, assetId);
    const bundleManifest = await readJson(path.join(assetDir, 'manifest.json'), 'BUNDLE_MANIFEST_INVALID');
    assertAssetManifest(bundleManifest, item, commit);
    await verifyManifestedFiles(assetDir, assetId, bundleManifest, item.bundleHash);

    const asset = await readJson(path.join(assetDir, 'asset.json'), 'ASSET_JSON_INVALID');
    assertReusableAssetSchema(validator, asset, assetId);
    assertAssetIdentity(asset, assetId, commit);
    if (asset.integrity?.asset_hash !== item.assetHash) fail(`Asset integrity hash mismatch: ${assetId}`, 'ASSET_INTEGRITY_HASH_MISMATCH');

    const units = await readJsonl(path.join(assetDir, 'knowledge-units.jsonl'), 'KNOWLEDGE_UNITS_EMPTY');
    const rels = await readJsonl(path.join(assetDir, 'relationships.jsonl'), 'RELATIONSHIPS_EMPTY');
    const cases = await readJsonl(path.join(assetDir, 'cases.jsonl'), 'CASES_EMPTY');
    if (units.length !== item.knowledgeUnits) fail(`Knowledge Unit count mismatch: ${assetId}`, 'KNOWLEDGE_UNIT_COUNT_MISMATCH');
    if (rels.length !== item.relationships) fail(`Relationship count mismatch: ${assetId}`, 'RELATIONSHIP_COUNT_MISMATCH');
    if (cases.length !== item.cases) fail(`Case count mismatch: ${assetId}`, 'CASE_COUNT_MISMATCH');

    const localCaseIds = new Set();
    for (const unit of units) {
      if (unit.schema_version !== 1 || !String(unit.knowledge_id ?? '') || unit.parent_asset_id !== assetId || !String(unit.knowledge_kind ?? '') || !String(unit.title ?? '') || !Array.isArray(unit.source_paths) || !unit.source_paths.length || !Array.isArray(unit.derivation?.derived_from) || !unit.derivation.derived_from.length) fail(`Knowledge Unit contract invalid: ${assetId}`, 'KNOWLEDGE_UNIT_INVALID');
      if (allUnitIds.has(unit.knowledge_id)) fail(`Duplicate Knowledge Unit id: ${unit.knowledge_id}`, 'KNOWLEDGE_UNIT_ID_DUPLICATE');
      allUnitIds.add(unit.knowledge_id);
    }
    for (const entry of cases) {
      if (entry.schema_version !== 1 || !String(entry.case_id ?? '') || entry.parent_asset_id !== assetId || !String(entry.source_test ?? '')) fail(`Case contract invalid: ${assetId}`, 'CASE_INVALID');
      if (localCaseIds.has(entry.case_id)) fail(`Duplicate Case id: ${entry.case_id}`, 'CASE_ID_DUPLICATE');
      localCaseIds.add(entry.case_id);
    }
    for (const relationship of rels) {
      if (relationship.schema_version !== 1 || !String(relationship.relationship_id ?? '') || !String(relationship.from ?? '') || !String(relationship.relation ?? '') || !String(relationship.to ?? '')) fail(`Relationship contract invalid: ${assetId}`, 'RELATIONSHIP_INVALID');
      if (allRelationshipIds.has(relationship.relationship_id)) fail(`Duplicate Relationship id: ${relationship.relationship_id}`, 'RELATIONSHIP_ID_GLOBAL_DUPLICATE');
      allRelationshipIds.add(relationship.relationship_id);
      relationships.push(relationship);
    }
    knowledgeUnitCount += units.length;
    relationshipCount += rels.length;
    caseCount += cases.length;
  }

  const allowedNodes = new Set([...assetIds, ...allUnitIds]);
  for (const relationship of relationships) {
    if (!allowedNodes.has(relationship.from) || !allowedNodes.has(relationship.to)) fail(`Relationship endpoint is unknown: ${relationship.relationship_id}`, 'RELATIONSHIP_TARGET_UNKNOWN');
  }

  return Object.freeze({
    valid: true,
    schema_version: 1,
    format: FORMAT,
    catalogCommit: commit,
    catalogRepository: CATALOG_REPOSITORY,
    manifestSha256: await sha256File(topManifestPath),
    assetCount: assetIds.length,
    knowledgeUnitCount,
    relationshipCount,
    caseCount,
    bundleRoot: delivery,
    manifest
  });
}

async function listDirectories(root) {
  if (!await exists(root)) return [];
  return (await fs.readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function listCompleteDeliveries(root) {
  const result = [];
  for (const name of await listDirectories(root)) {
    if (await exists(path.join(root, name, 'manifest.json'))) result.push(name);
  }
  return result;
}

function kbPaths(kbRoot, commit) {
  const root = path.resolve(kbRoot);
  const inbox = path.join(root, 'data', 'knowledge-inbox', 'modulecatalog');
  return {
    root,
    inbox,
    ready: path.join(inbox, 'ready'),
    processing: path.join(inbox, 'processing'),
    processed: path.join(inbox, 'processed'),
    failed: path.join(inbox, 'failed'),
    finalDelivery: path.join(inbox, 'ready', commit),
    receipt: path.join(root, 'data', 'knowledge-intake', 'modulecatalog', 'receipts', `${commit}.json`),
    activeMarker: path.join(root, 'data', 'knowledge-records', 'modulecatalog-reusable-active.json')
  };
}

function assertStateIdentity(value, summary, label) {
  if (!value || typeof value !== 'object') fail(`${label} is missing or invalid.`, label === 'Current marker' ? 'KB_CURRENT_MISMATCH' : 'KB_RECEIPT_MISMATCH');
  const checks = [
    ['catalogRepository', CATALOG_REPOSITORY],
    ['catalogCommit', summary.catalogCommit],
    ['deliveryManifestSha256', summary.manifestSha256],
    ['assetCount', summary.assetCount],
    ['knowledgeUnitCount', summary.knowledgeUnitCount],
    ['relationshipCount', summary.relationshipCount],
    ['caseCount', summary.caseCount]
  ];
  for (const [key, expected] of checks) {
    if (value[key] !== expected) fail(`${label} identity mismatch: ${key}`, label === 'Current marker' ? 'KB_CURRENT_MISMATCH' : 'KB_RECEIPT_MISMATCH', { key, expected, actual: value[key] });
  }
}

export async function readKbDeliveryState(rootDir, deliveryRoot, kbRoot) {
  const summary = await preflightDelivery(rootDir, deliveryRoot);
  const paths = kbPaths(kbRoot, summary.catalogCommit);
  const receipt = await readJsonIfExists(paths.receipt);
  const current = await readJsonIfExists(paths.activeMarker);

  if (receipt?.catalogCommit === summary.catalogCommit && receipt.deliveryManifestSha256 && String(receipt.deliveryManifestSha256).toLowerCase() !== summary.manifestSha256) fail('Existing KB receipt has the same Catalog commit with a different delivery manifest hash.', 'KB_DELIVERY_IDENTITY_CONFLICT');
  if (current?.catalogCommit === summary.catalogCommit && current.deliveryManifestSha256 && String(current.deliveryManifestSha256).toLowerCase() !== summary.manifestSha256) fail('Existing KB Current marker has the same Catalog commit with a different delivery manifest hash.', 'KB_DELIVERY_IDENTITY_CONFLICT');

  if (receipt?.status === 'ACTIVE') {
    if (current?.status !== 'ACTIVE' || current.catalogCommit !== summary.catalogCommit) fail('Historical ACTIVE receipt does not match current KB authority.', 'KB_STALE_REDELIVERY_REJECTED');
    assertStateIdentity(receipt, summary, 'Receipt');
    assertStateIdentity(current, summary, 'Current marker');
    return Object.freeze({ status: 'COMPLETE', code: 'COMPLETE', summary, receipt, current });
  }
  if (receipt?.status === 'ACCEPTED') {
    if (current?.status === 'ACTIVE' && current.catalogCommit === summary.catalogCommit) fail('KB Current is ACTIVE but the matching receipt is not ACTIVE.', 'KB_RECEIPT_MISMATCH');
    assertStateIdentity(receipt, summary, 'Receipt');
    return Object.freeze({ status: 'ACCEPTED', code: 'KB_ACCEPTED_PENDING_ACTIVE', summary, receipt, current });
  }

  const processed = path.join(paths.processed, summary.catalogCommit);
  if (await exists(processed) && current?.catalogCommit !== summary.catalogCommit) fail('A processed historical delivery must not be republished as current without an explicit version-order contract.', 'KB_STALE_REDELIVERY_REJECTED');
  if (await exists(path.join(paths.processing, summary.catalogCommit))) return Object.freeze({ status: 'PROCESSING', code: 'KB_RECEIVER_BUSY', summary, receipt, current });
  if (await exists(paths.finalDelivery)) return Object.freeze({ status: 'PUBLISHED', code: 'PUBLISHED', summary, receipt, current });
  const failed = (await listDirectories(paths.failed)).filter((name) => name === summary.catalogCommit || name.startsWith(`${summary.catalogCommit}-`));
  if (failed.length) return Object.freeze({ status: 'FAILED', code: 'KB_DELIVERY_FAILED', summary, receipt, current, failed });
  return Object.freeze({ status: 'NOT_FOUND', code: 'KB_RECEIPT_PENDING', summary, receipt, current });
}

export async function publishDelivery(rootDir, deliveryRoot, kbRoot) {
  const summary = await preflightDelivery(rootDir, deliveryRoot);
  const paths = kbPaths(kbRoot, summary.catalogCommit);
  const catalogRoot = path.resolve(rootDir);
  if (paths.inbox === catalogRoot || paths.inbox.startsWith(catalogRoot + path.sep)) fail('KB inbox must be outside the ModuleCatalog working tree.', 'KB_DELIVERY_TARGET_UNSAFE');
  for (const required of [paths.inbox, paths.ready, paths.processing, paths.processed, paths.failed]) await assertDirectory(required);

  const existingState = await readKbDeliveryState(rootDir, deliveryRoot, kbRoot);
  if (['COMPLETE', 'ACCEPTED', 'PROCESSING', 'PUBLISHED'].includes(existingState.status)) return Object.freeze({ status: existingState.status, idempotent: true, published: false, summary });

  const processingDirs = await listDirectories(paths.processing);
  if (processingDirs.length) fail(`KB receiver already has a processing delivery: ${processingDirs.join(',')}`, 'KB_RECEIVER_BUSY');
  const completeReady = await listCompleteDeliveries(paths.ready);
  if (completeReady.length) fail(`KB ready inbox is occupied: ${completeReady.join(',')}`, 'KB_READY_OCCUPIED');
  if (await exists(paths.finalDelivery)) fail(`KB ready delivery path already exists without a usable completion identity: ${paths.finalDelivery}`, 'KB_READY_OCCUPIED');

  const temp = path.join(paths.inbox, `.${summary.catalogCommit}.incoming-${process.pid}-${crypto.randomUUID()}`);
  try {
    await fs.cp(path.resolve(deliveryRoot), temp, { recursive: true, errorOnExist: true, force: false });
    const copied = await preflightDelivery(rootDir, temp);
    if (copied.manifestSha256 !== summary.manifestSha256 || copied.assetCount !== summary.assetCount || copied.knowledgeUnitCount !== summary.knowledgeUnitCount || copied.relationshipCount !== summary.relationshipCount || copied.caseCount !== summary.caseCount) fail('Target-side delivery copy does not match the producer bundle.', 'KB_DELIVERY_COPY_MISMATCH');
    await fs.rename(temp, paths.finalDelivery);
    const published = await preflightDelivery(rootDir, paths.finalDelivery);
    if (published.manifestSha256 !== summary.manifestSha256) fail('Published delivery manifest readback mismatch.', 'KB_DELIVERY_PUBLISH_READBACK_FAILED');
    return Object.freeze({ status: 'PUBLISHED', code: 'PUBLISHED', idempotent: false, published: true, summary: published, deliveryPath: paths.finalDelivery });
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function verifyKbActive(rootDir, deliveryRoot, kbRoot) {
  const state = await readKbDeliveryState(rootDir, deliveryRoot, kbRoot);
  if (state.status === 'COMPLETE') return state;
  return state;
}
