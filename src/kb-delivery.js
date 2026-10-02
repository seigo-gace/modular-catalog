import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { CatalogError, sha256 } from './catalog.js';
import { createReusableAssetValidator, assertReusableAssetSchema } from './reusable-asset-schema.js';

const FORMAT = 'gace.reusable-asset.v1';
const CATALOG_REPOSITORY = 'seigo-gace/modular-catalog';
const BUNDLE_DATA_FILES = ['asset.json', 'knowledge-units.jsonl', 'relationships.jsonl', 'cases.jsonl'];
const REQUIRED_ASSET_FILES = [...BUNDLE_DATA_FILES, 'manifest.json'];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function assertDirectory(target, code = 'KB_DELIVERY_NOT_CONFIGURED') {
  try {
    const stat = await fs.stat(target);
    if (!stat.isDirectory()) throw new Error('not a directory');
  } catch {
    throw new CatalogError(`Required directory is unavailable: ${target}`, code);
  }
}

async function readJson(file, code = 'INVALID_JSON') {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON object required');
    return parsed;
  } catch (error) {
    throw new CatalogError(`${file}: ${error.message}`, code);
  }
}

async function fileSha256(file) {
  return sha256(await fs.readFile(file));
}

function normalizeHash(value) {
  return String(value ?? '').trim().toLowerCase();
}

function countJsonl(content, file) {
  if (!content.trim()) return 0;
  const rows = content.split(/\r?\n/).filter((line) => line.trim());
  for (const line of rows) {
    try {
      JSON.parse(line);
    } catch (error) {
      throw new CatalogError(`${file}: invalid JSONL row: ${error.message}`, 'DELIVERY_JSONL_INVALID');
    }
  }
  return rows.length;
}

function assertCommit(commit) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/i.test(commit)) {
    throw new CatalogError(`Invalid Catalog commit: ${commit}`, 'DELIVERY_CATALOG_COMMIT_INVALID');
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function isInside(parent, target) {
  const base = path.resolve(parent);
  const child = path.resolve(target);
  return child === base || child.startsWith(base + path.sep);
}

async function verifyAssetBundle(deliveryRoot, item, topManifest, schemaValidator) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new CatalogError('Invalid asset entry in delivery manifest.', 'DELIVERY_ASSET_ENTRY_INVALID');
  }
  const id = String(item.id ?? '');
  if (!id) throw new CatalogError('Delivery asset id is required.', 'DELIVERY_ASSET_ID_INVALID');
  const assetDir = path.join(deliveryRoot, 'assets', id);
  for (const name of REQUIRED_ASSET_FILES) {
    const file = path.join(assetDir, name);
    if (!await exists(file)) throw new CatalogError(`Missing delivery file: assets/${id}/${name}`, 'DELIVERY_FILE_MISSING');
  }

  const asset = await readJson(path.join(assetDir, 'asset.json'), 'DELIVERY_ASSET_JSON_INVALID');
  assertReusableAssetSchema(schemaValidator, asset, id);
  if (asset.identity?.asset_id !== id) throw new CatalogError(`Asset identity mismatch: ${id}`, 'DELIVERY_ASSET_ID_MISMATCH');
  if (asset.provenance?.catalog?.repository !== CATALOG_REPOSITORY) throw new CatalogError(`Asset Catalog repository mismatch: ${id}`, 'DELIVERY_CATALOG_REPOSITORY_MISMATCH');
  if (asset.provenance?.catalog?.commit !== topManifest.catalog.commit) throw new CatalogError(`Asset Catalog commit mismatch: ${id}`, 'DELIVERY_CATALOG_COMMIT_MISMATCH');
  if (asset.integrity?.asset_hash !== item.assetHash) throw new CatalogError(`Asset hash mismatch: ${id}`, 'DELIVERY_ASSET_HASH_MISMATCH');

  const bundleManifest = await readJson(path.join(assetDir, 'manifest.json'), 'DELIVERY_BUNDLE_MANIFEST_INVALID');
  if (bundleManifest.schema_version !== 1 || bundleManifest.format !== FORMAT) throw new CatalogError(`Unsupported bundle manifest: ${id}`, 'DELIVERY_MANIFEST_FORMAT_UNSUPPORTED');
  if (bundleManifest.asset_id !== id) throw new CatalogError(`Bundle asset id mismatch: ${id}`, 'DELIVERY_ASSET_ID_MISMATCH');
  if (bundleManifest.catalog?.repository !== CATALOG_REPOSITORY || bundleManifest.catalog?.commit !== topManifest.catalog.commit) {
    throw new CatalogError(`Bundle provenance mismatch: ${id}`, 'DELIVERY_BUNDLE_PROVENANCE_MISMATCH');
  }
  if (bundleManifest.source_asset_hash !== item.assetHash || bundleManifest.bundle_hash !== item.bundleHash) {
    throw new CatalogError(`Bundle hash declaration mismatch: ${id}`, 'DELIVERY_BUNDLE_HASH_MISMATCH');
  }
  if (!Array.isArray(bundleManifest.files) || bundleManifest.files.length !== BUNDLE_DATA_FILES.length) {
    throw new CatalogError(`Bundle file manifest invalid: ${id}`, 'DELIVERY_BUNDLE_FILES_INVALID');
  }
  if (new Set(bundleManifest.files.map((entry) => entry?.path)).size !== BUNDLE_DATA_FILES.length) {
    throw new CatalogError(`Bundle file manifest contains duplicate paths: ${id}`, 'DELIVERY_BUNDLE_FILES_INVALID');
  }
  if (BUNDLE_DATA_FILES.some((name) => !bundleManifest.files.some((entry) => entry?.path === name))) {
    throw new CatalogError(`Bundle file manifest is incomplete: ${id}`, 'DELIVERY_BUNDLE_FILES_INVALID');
  }

  for (const declared of bundleManifest.files) {
    const name = String(declared?.path ?? '');
    if (!BUNDLE_DATA_FILES.includes(name)) throw new CatalogError(`Unexpected bundle file declaration: ${id}/${name}`, 'DELIVERY_BUNDLE_FILES_INVALID');
    const file = path.join(assetDir, name);
    const content = await fs.readFile(file);
    const actual = { path: name, size: content.length, sha256: sha256(content) };
    if (Number(declared.size) !== actual.size || normalizeHash(declared.sha256) !== actual.sha256) {
      throw new CatalogError(`Bundle file integrity mismatch: ${id}/${name}`, 'DELIVERY_BUNDLE_INTEGRITY_FAILED');
    }
  }

  const declaredForHash = bundleManifest.files.map((entry) => ({ path: entry.path, size: entry.size, sha256: entry.sha256 }));
  if (sha256(canonicalJson(declaredForHash)) !== normalizeHash(bundleManifest.bundle_hash)) {
    throw new CatalogError(`Bundle hash verification failed: ${id}`, 'DELIVERY_BUNDLE_INTEGRITY_FAILED');
  }

  const knowledgeUnits = countJsonl(await fs.readFile(path.join(assetDir, 'knowledge-units.jsonl'), 'utf8'), `${id}/knowledge-units.jsonl`);
  const relationships = countJsonl(await fs.readFile(path.join(assetDir, 'relationships.jsonl'), 'utf8'), `${id}/relationships.jsonl`);
  const cases = countJsonl(await fs.readFile(path.join(assetDir, 'cases.jsonl'), 'utf8'), `${id}/cases.jsonl`);
  if (knowledgeUnits !== Number(item.knowledgeUnits) || relationships !== Number(item.relationships) || cases !== Number(item.cases)) {
    throw new CatalogError(`Declared record count mismatch: ${id}`, 'DELIVERY_RECORD_COUNT_MISMATCH');
  }

  return { id, knowledgeUnits, relationships, cases, bundleHash: bundleManifest.bundle_hash, assetHash: item.assetHash };
}

export async function preflightDelivery(rootDir, deliveryRoot) {
  const root = path.resolve(rootDir);
  const delivery = path.resolve(deliveryRoot);
  const manifestFile = path.join(delivery, 'manifest.json');
  if (!await exists(manifestFile)) throw new CatalogError(`Delivery manifest missing: ${manifestFile}`, 'DELIVERY_MANIFEST_MISSING');
  const manifest = await readJson(manifestFile, 'DELIVERY_MANIFEST_INVALID');
  if (manifest.schema_version !== 1 || manifest.format !== FORMAT) throw new CatalogError('Unsupported delivery manifest format.', 'DELIVERY_MANIFEST_FORMAT_UNSUPPORTED');
  if (manifest.catalog?.repository !== CATALOG_REPOSITORY) throw new CatalogError('Delivery Catalog repository mismatch.', 'DELIVERY_CATALOG_REPOSITORY_MISMATCH');
  assertCommit(manifest.catalog?.commit);
  if (!Array.isArray(manifest.assets) || manifest.assets.length < 1) throw new CatalogError('Delivery assets are required.', 'DELIVERY_ASSETS_EMPTY');
  if (Number(manifest.assetCount) !== manifest.assets.length) throw new CatalogError('Delivery asset count mismatch.', 'DELIVERY_ASSET_COUNT_MISMATCH');
  if (new Set(manifest.assets.map((entry) => entry?.id)).size !== manifest.assets.length) throw new CatalogError('Delivery contains duplicate asset ids.', 'DELIVERY_ASSET_DUPLICATE');

  const schemaValidator = await createReusableAssetValidator(root);
  const verified = [];
  for (const item of manifest.assets) verified.push(await verifyAssetBundle(delivery, item, manifest, schemaValidator));
  const totals = verified.reduce((acc, item) => ({
    knowledgeUnits: acc.knowledgeUnits + item.knowledgeUnits,
    relationships: acc.relationships + item.relationships,
    cases: acc.cases + item.cases
  }), { knowledgeUnits: 0, relationships: 0, cases: 0 });

  return Object.freeze({
    format: FORMAT,
    catalogCommit: manifest.catalog.commit,
    assetCount: manifest.assets.length,
    knowledgeUnitCount: totals.knowledgeUnits,
    relationshipCount: totals.relationships,
    caseCount: totals.cases,
    manifestSha256: await fileSha256(manifestFile),
    manifest
  });
}

async function listCompleteDeliveries(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(directory, entry.name);
    if (await exists(path.join(full, 'manifest.json'))) result.push({ name: entry.name, path: full });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

async function sameDeliveryIdentity(directory, expected) {
  const manifestFile = path.join(directory, 'manifest.json');
  if (!await exists(manifestFile)) return false;
  const manifest = await readJson(manifestFile, 'DELIVERY_MANIFEST_INVALID');
  return manifest.catalog?.commit === expected.catalogCommit && await fileSha256(manifestFile) === expected.manifestSha256;
}

export async function publishDelivery(rootDir, deliveryRoot, inboxBase) {
  const root = path.resolve(rootDir);
  const preflight = await preflightDelivery(root, deliveryRoot);
  const base = path.resolve(inboxBase);
  if (isInside(root, base)) throw new CatalogError('KB inbox must be outside the ModuleCatalog working tree.', 'KB_DELIVERY_TARGET_UNSAFE');
  await assertDirectory(base);

  const ready = path.join(base, 'ready');
  const processing = path.join(base, 'processing');
  const processed = path.join(base, 'processed');
  const failed = path.join(base, 'failed');
  for (const directory of [ready, processing, processed, failed]) await assertDirectory(directory);
  const producerTemp = path.join(base, '.producer-publish');
  await fs.mkdir(producerTemp, { recursive: true });

  const deliveryId = preflight.catalogCommit;
  const finalReady = path.join(ready, deliveryId);
  const pendingProcessing = path.join(processing, deliveryId);
  const priorProcessed = path.join(processed, deliveryId);

  if (await exists(finalReady)) {
    if (await sameDeliveryIdentity(finalReady, preflight)) return Object.freeze({ status: 'PUBLISHED', idempotent: true, deliveryId, path: finalReady, ...preflight });
    throw new CatalogError(`Ready delivery identity conflict: ${deliveryId}`, 'KB_DELIVERY_IDENTITY_CONFLICT');
  }
  if (await exists(pendingProcessing)) {
    if (await sameDeliveryIdentity(pendingProcessing, preflight)) return Object.freeze({ status: 'PROCESSING', idempotent: true, deliveryId, path: pendingProcessing, ...preflight });
    throw new CatalogError(`Processing delivery identity conflict: ${deliveryId}`, 'KB_DELIVERY_IDENTITY_CONFLICT');
  }
  if (await exists(priorProcessed)) {
    throw new CatalogError(`Delivery was already processed and must not be republished without current-state readback: ${deliveryId}`, 'KB_PREVIOUSLY_PROCESSED');
  }

  const completeReady = await listCompleteDeliveries(ready);
  if (completeReady.length > 0) {
    throw new CatalogError(`KB ready slot is occupied by ${completeReady.map((entry) => entry.name).join(',')}`, 'KB_READY_OCCUPIED');
  }

  const tempName = `.${deliveryId}.${process.pid}.${crypto.randomUUID()}`;
  const targetTemp = path.join(producerTemp, tempName);
  try {
    await fs.cp(path.resolve(deliveryRoot), targetTemp, { recursive: true, errorOnExist: true, force: false });
    const copied = await preflightDelivery(root, targetTemp);
    if (copied.catalogCommit !== preflight.catalogCommit || copied.manifestSha256 !== preflight.manifestSha256 || copied.assetCount !== preflight.assetCount || copied.knowledgeUnitCount !== preflight.knowledgeUnitCount || copied.relationshipCount !== preflight.relationshipCount || copied.caseCount !== preflight.caseCount) {
      throw new CatalogError('Target-side delivery readback does not match producer preflight.', 'KB_DELIVERY_COPY_MISMATCH');
    }
    await fs.rename(targetTemp, finalReady);
    const published = await preflightDelivery(root, finalReady);
    if (published.manifestSha256 !== preflight.manifestSha256 || published.catalogCommit !== preflight.catalogCommit) {
      throw new CatalogError('Published delivery readback does not match producer identity.', 'KB_DELIVERY_COPY_MISMATCH');
    }
    return Object.freeze({ status: 'PUBLISHED', idempotent: false, deliveryId, path: finalReady, ...published });
  } finally {
    if (await exists(targetTemp)) await fs.rm(targetTemp, { recursive: true, force: true });
  }
}

function assertCount(value, expected, field, code = 'KB_RECEIPT_MISMATCH') {
  if (Number(value) !== Number(expected)) throw new CatalogError(`KB ${field} mismatch: expected=${expected} actual=${value}`, code);
}

export async function verifyKbActive(rootDir, deliveryRoot, kbRoot) {
  const expected = await preflightDelivery(rootDir, deliveryRoot);
  const root = path.resolve(kbRoot);
  await assertDirectory(root);
  const receiptFile = path.join(root, 'data', 'knowledge-intake', 'modulecatalog', 'receipts', `${expected.catalogCommit}.json`);
  const currentFile = path.join(root, 'data', 'knowledge-records', 'modulecatalog-reusable-active.json');
  if (!await exists(receiptFile)) return Object.freeze({ status: 'PENDING', code: 'KB_RECEIPT_PENDING', catalogCommit: expected.catalogCommit });

  const receipt = await readJson(receiptFile, 'KB_RECEIPT_INVALID');
  if (receipt.catalogCommit !== expected.catalogCommit) throw new CatalogError('KB receipt commit mismatch.', 'KB_RECEIPT_MISMATCH');
  if (normalizeHash(receipt.deliveryManifestSha256) !== expected.manifestSha256) throw new CatalogError('KB receipt delivery manifest hash mismatch.', 'KB_RECEIPT_MISMATCH');
  assertCount(receipt.assetCount, expected.assetCount, 'receipt assetCount');
  assertCount(receipt.knowledgeUnitCount, expected.knowledgeUnitCount, 'receipt knowledgeUnitCount');
  assertCount(receipt.relationshipCount, expected.relationshipCount, 'receipt relationshipCount');
  assertCount(receipt.caseCount, expected.caseCount, 'receipt caseCount');

  if (receipt.status === 'ACCEPTED') return Object.freeze({ status: 'ACCEPTED', code: 'KB_ACCEPTED_PENDING_ACTIVE', catalogCommit: expected.catalogCommit, receipt });
  if (receipt.status !== 'ACTIVE') throw new CatalogError(`Unexpected KB receipt status: ${receipt.status}`, 'KB_RECEIPT_MISMATCH');
  if (!await exists(currentFile)) throw new CatalogError('KB ACTIVE receipt exists without current authority.', 'KB_CURRENT_MISMATCH');

  const current = await readJson(currentFile, 'KB_CURRENT_INVALID');
  if (current.status !== 'ACTIVE' || current.catalogCommit !== expected.catalogCommit) throw new CatalogError('KB current authority does not match delivered commit.', 'KB_CURRENT_MISMATCH');
  if (normalizeHash(current.deliveryManifestSha256) !== expected.manifestSha256) throw new CatalogError('KB current authority manifest hash mismatch.', 'KB_CURRENT_MISMATCH');
  assertCount(current.assetCount, expected.assetCount, 'current assetCount', 'KB_CURRENT_MISMATCH');
  assertCount(current.knowledgeUnitCount, expected.knowledgeUnitCount, 'current knowledgeUnitCount', 'KB_CURRENT_MISMATCH');
  assertCount(current.relationshipCount, expected.relationshipCount, 'current relationshipCount', 'KB_CURRENT_MISMATCH');
  assertCount(current.caseCount, expected.caseCount, 'current caseCount', 'KB_CURRENT_MISMATCH');

  return Object.freeze({ status: 'COMPLETE', code: 'COMPLETE', catalogCommit: expected.catalogCommit, receipt, current });
}
