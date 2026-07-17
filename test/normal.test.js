import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CatalogError,
  buildIndex,
  loadAssetSection,
  registerAsset,
  searchCatalog,
  validateAssetDirectory,
  verifyIndex
} from '../src/catalog.js';

const fixture = path.resolve('test/fixtures/valid-asset');

async function workspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'modular-catalog-'));
  await fs.mkdir(path.join(root, 'catalog'), { recursive: true });
  await fs.writeFile(path.join(root, 'catalog/index.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date(0).toISOString(), assetCount: 0, entries: [] }));
  return root;
}

async function copy(source, target) {
  await fs.cp(source, target, { recursive: true });
}

test('registers a complete verified asset and builds a hash-backed index', async () => {
  const root = await workspace();
  try {
    const result = await registerAsset(root, fixture);
    assert.equal(result.id, 'verified-http-retry');
    assert.match(result.assetHash, /^[a-f0-9]{64}$/);
    const index = JSON.parse(await fs.readFile(path.join(root, 'catalog/index.json'), 'utf8'));
    assert.equal(index.assetCount, 1);
    assert.equal(index.entries[0].id, 'verified-http-retry');
    assert.equal(index.entries[0].assetHash, result.assetHash);
    assert.equal((await verifyIndex(root)).assetCount, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('multi-stage search finds the correct verified asset with filters', async () => {
  const root = await workspace();
  try {
    await registerAsset(root, fixture);
    const results = await searchCatalog(root, { query: 'http retry', language: 'javascript', runtime: 'node', layer: 'Feature' });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'verified-http-retry');
    assert.ok(results[0].score > 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('selective read returns only the requested section', async () => {
  const root = await workspace();
  try {
    await registerAsset(root, fixture);
    const meta = await loadAssetSection(root, 'verified-http-retry', 'meta');
    assert.deepEqual(Object.keys(meta), ['meta.json']);
    assert.equal(Object.keys(meta).some((key) => key.startsWith('code/')), false);
    const code = await loadAssetSection(root, 'verified-http-retry', 'code');
    assert.deepEqual(Object.keys(code), ['code/retry.js']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('rejects assets without both passed test systems', async () => {
  const root = await workspace();
  const candidate = path.join(root, 'candidate');
  await copy(fixture, candidate);
  const evidencePath = path.join(candidate, 'evidence.json');
  const evidence = JSON.parse(await fs.readFile(evidencePath, 'utf8'));
  evidence.user.passed = false;
  await fs.writeFile(evidencePath, JSON.stringify(evidence));
  await assert.rejects(() => validateAssetDirectory(candidate), (error) => error instanceof CatalogError && error.code === 'UNVERIFIED_ASSET');
  await fs.rm(root, { recursive: true, force: true });
});

test('rejects possible secrets', async () => {
  const root = await workspace();
  const candidate = path.join(root, 'candidate');
  await copy(fixture, candidate);
  await fs.writeFile(path.join(candidate, 'code/secret.js'), 'const apiKey = "sk-123456789012345678901234567890";');
  await assert.rejects(() => validateAssetDirectory(candidate), (error) => error instanceof CatalogError && error.code === 'SECRET_DETECTED');
  await fs.rm(root, { recursive: true, force: true });
});

test('detects file tampering through manifest verification', async () => {
  const root = await workspace();
  try {
    await registerAsset(root, fixture);
    const file = path.join(root, 'assets/verified-http-retry/code/retry.js');
    await fs.appendFile(file, '\n// tampered\n');
    await assert.rejects(() => validateAssetDirectory(path.dirname(path.dirname(file)), { verifyManifest: true }), (error) => error instanceof CatalogError && error.code === 'INTEGRITY_MISMATCH');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('buildIndex supports an empty operational catalog', async () => {
  const root = await workspace();
  try {
    const index = await buildIndex(root);
    assert.equal(index.assetCount, 0);
    assert.deepEqual(index.entries, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
