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

async function buildLegacyCandidate(root) {
  const candidate = path.join(root, 'legacy-candidate');
  const meta = {
    schemaVersion: 1,
    id: 'legacy-skill-code-asset',
    name: 'Legacy Skill Code Asset',
    version: '1.0.0',
    summary: 'Verified legacy registered asset with source, design, logic, architecture and tests.',
    purpose: 'Exercise deterministic reusable type discovery for the registered legacy asset contract.',
    responsibility: 'Expose only reusable types proven by the validated registered asset structure.',
    layers: ['Part'],
    languages: ['JavaScript'],
    runtimes: ['Node.js 22+'],
    tags: ['skill', 'reusable'],
    dependencies: [],
    constraints: [],
    source: { repository: 'example/legacy-repo', commit: '3333333333333333333333333333333333333333' },
    verifiedAt: '2026-10-03T00:00:00.000Z'
  };
  await write(path.join(candidate, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  await write(path.join(candidate, 'design.md'), '# Design\nValidated legacy design.\n');
  await write(path.join(candidate, 'logic.md'), '# Logic\nValidated legacy logic.\n');
  await write(path.join(candidate, 'architecture.md'), '# Architecture\nValidated legacy architecture.\n');
  await write(path.join(candidate, 'source/index.js'), 'module.exports = function run(value) { return value; };\n');
  await write(path.join(candidate, 'evidence.json'), JSON.stringify({
    normal: { passed: true, commands: ['node --test tests/normal/legacy.test.cjs'], expectedResults: ['PASS'] },
    user: { passed: true, commands: ['node --test tests/user/legacy.test.cjs'], expectedResults: ['PASS'] }
  }, null, 2) + '\n');
  await write(path.join(candidate, 'tests/normal/legacy.test.cjs'), "const test=require('node:test');test('normal',()=>{});\n");
  await write(path.join(candidate, 'tests/user/legacy.test.cjs'), "const test=require('node:test');test('user',()=>{});\n");
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

test('searches validated legacy assets by deterministic reusable content types without promoting 5V', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-derived-type-search-'));
  try {
    const candidate = await buildLegacyCandidate(root);
    const result = await registerAsset(root, candidate);
    assert.equal(result.id, 'legacy-skill-code-asset');

    for (const assetType of ['capability', 'skill', 'code', 'design', 'logic', 'architecture', 'test']) {
      const matches = await searchCatalog(root, { query: 'legacy registered asset', assetType, limit: 5 });
      assert.equal(matches.length, 1, `expected one ${assetType} match`);
      assert.equal(matches[0].id, 'legacy-skill-code-asset');
      assert.ok(matches[0].reusableAssetTypes.includes(assetType));
    }

    const fiveVPart = await searchCatalog(root, { query: 'legacy registered asset', fiveVLevel: 'Part', limit: 5 });
    assert.deepEqual(fiveVPart, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
