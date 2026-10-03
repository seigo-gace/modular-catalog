import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { registerAsset, searchCatalog } from '../src/catalog.js';

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

async function buildCandidate(root) {
  const candidate = path.join(root, 'candidate');
  const meta = {
    schemaVersion: 1,
    id: 'architecture-reuse-asset',
    name: 'Architecture Reuse Asset',
    version: '1.0.0',
    summary: 'Reusable architecture decision asset.',
    purpose: 'Reuse a verified architecture decision independently of source code.',
    responsibility: 'Preserve architecture decisions and their verified usage boundary.',
    layers: [],
    languages: [],
    runtimes: [],
    tags: ['architecture', 'reusable'],
    dependencies: [],
    constraints: [],
    reusableAssetTypes: ['architecture', 'design'],
    assetKind: 'architecture',
    fiveV: { applicable: false, verificationBasis: ['architecture.md', 'tests/normal/architecture-review.txt', 'tests/user/architecture-use.txt'] },
    source: { repository: 'example/architecture-repo', commit: '2222222222222222222222222222222222222222' },
    verifiedAt: '2026-10-03T00:00:00.000Z'
  };
  await write(path.join(candidate, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  await write(path.join(candidate, 'design.md'), '# Design\nArchitecture design rationale.\n');
  await write(path.join(candidate, 'logic.md'), '# Logic\nArchitecture decision logic.\n');
  await write(path.join(candidate, 'architecture.md'), '# Architecture\nVerified architecture decision.\n');
  await write(path.join(candidate, 'evidence.json'), JSON.stringify({
    normal: { passed: true, commands: ['architecture-review'], expectedResults: ['PASS'] },
    user: { passed: true, commands: ['architecture-use'], expectedResults: ['PASS'] }
  }, null, 2) + '\n');
  await write(path.join(candidate, 'tests/normal/architecture-review.txt'), 'PASS\n');
  await write(path.join(candidate, 'tests/user/architecture-use.txt'), 'PASS\n');
  return candidate;
}

test('registers and searches a verified non-code reusable asset by reusable asset type', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-type-search-'));
  try {
    const candidate = await buildCandidate(root);
    const result = await registerAsset(root, candidate);
    assert.equal(result.id, 'architecture-reuse-asset');

    const architecture = await searchCatalog(root, { query: 'architecture decision', assetType: 'architecture', limit: 5 });
    assert.equal(architecture.length, 1);
    assert.equal(architecture[0].id, 'architecture-reuse-asset');
    assert.deepEqual(architecture[0].reusableAssetTypes, ['architecture', 'design']);
    assert.equal(architecture[0].fiveV.applicable, false);

    const codeOnly = await searchCatalog(root, { query: 'architecture decision', assetType: 'code', limit: 5 });
    assert.deepEqual(codeOnly, []);

    const fiveVPart = await searchCatalog(root, { query: 'architecture decision', fiveVLevel: 'Part', limit: 5 });
    assert.deepEqual(fiveVPart, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
