import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateAssetDirectory } from '../src/catalog.js';

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

function baseMeta(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'design-reuse-asset',
    name: 'Design Reuse Asset',
    version: '1.0.0',
    summary: 'Reusable design asset.',
    purpose: 'Reuse an explicitly verified design without inventing code metadata.',
    responsibility: 'Preserve reusable design decisions.',
    layers: [],
    languages: [],
    runtimes: [],
    tags: ['design', 'reusable'],
    dependencies: [],
    constraints: [],
    reusableAssetTypes: ['design'],
    assetKind: 'design',
    fiveV: { applicable: false, verificationBasis: ['design.md', 'tests/normal/design-review.txt', 'tests/user/design-use.txt'] },
    source: { repository: 'example/design-repo', commit: '1111111111111111111111111111111111111111' },
    verifiedAt: '2026-10-03T00:00:00.000Z',
    ...overrides
  };
}

async function materializePureDesign(dir, meta) {
  await write(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  await write(path.join(dir, 'design.md'), '# Design\nVerified design content.\n');
  await write(path.join(dir, 'evidence.json'), JSON.stringify({
    normal: { passed: true, commands: ['design-review'], expectedResults: ['PASS'] },
    user: { passed: true, commands: ['design-use'], expectedResults: ['PASS'] }
  }, null, 2) + '\n');
  await write(path.join(dir, 'tests/normal/design-review.txt'), 'PASS\n');
  await write(path.join(dir, 'tests/user/design-use.txt'), 'PASS\n');
}

async function materializeLegacy(dir, meta) {
  await write(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  await write(path.join(dir, 'design.md'), '# Design\nVerified design content.\n');
  await write(path.join(dir, 'logic.md'), '# Logic\nVerified logic content.\n');
  await write(path.join(dir, 'architecture.md'), '# Architecture\nVerified architecture content.\n');
  await write(path.join(dir, 'evidence.json'), JSON.stringify({
    normal: { passed: true, commands: ['legacy-normal'], expectedResults: ['PASS'] },
    user: { passed: true, commands: ['legacy-user'], expectedResults: ['PASS'] }
  }, null, 2) + '\n');
  await write(path.join(dir, 'tests/normal/legacy.txt'), 'PASS\n');
  await write(path.join(dir, 'tests/user/legacy.txt'), 'PASS\n');
}

test('pure design asset requires only its recorded design document and verification evidence', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-noncode-'));
  try {
    await materializePureDesign(dir, baseMeta());
    const result = await validateAssetDirectory(dir);
    assert.equal(result.meta.assetKind, 'design');
    assert.deepEqual(result.meta.reusableAssetTypes, ['design']);
    assert.deepEqual(result.meta.layers, []);
    await assert.rejects(fs.stat(path.join(dir, 'source')));
    await assert.rejects(fs.stat(path.join(dir, 'logic.md')));
    await assert.rejects(fs.stat(path.join(dir, 'architecture.md')));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('explicit logic asset requires logic.md instead of unrelated design or architecture documents', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-logic-'));
  try {
    const meta = baseMeta({
      id: 'logic-reuse-asset',
      name: 'Logic Reuse Asset',
      reusableAssetTypes: ['logic'],
      assetKind: 'logic',
      fiveV: { applicable: false, verificationBasis: ['logic.md', 'tests/normal/design-review.txt', 'tests/user/design-use.txt'] }
    });
    await write(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    await write(path.join(dir, 'logic.md'), '# Logic\nVerified reusable logic.\n');
    await write(path.join(dir, 'evidence.json'), JSON.stringify({
      normal: { passed: true, commands: ['logic-review'], expectedResults: ['PASS'] },
      user: { passed: true, commands: ['logic-use'], expectedResults: ['PASS'] }
    }, null, 2) + '\n');
    await write(path.join(dir, 'tests/normal/design-review.txt'), 'PASS\n');
    await write(path.join(dir, 'tests/user/design-use.txt'), 'PASS\n');
    const result = await validateAssetDirectory(dir);
    assert.deepEqual(result.meta.reusableAssetTypes, ['logic']);
    await assert.rejects(fs.stat(path.join(dir, 'design.md')));
    await assert.rejects(fs.stat(path.join(dir, 'architecture.md')));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('legacy asset without explicit reusable types keeps the existing strict document and source contract', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-legacy-strict-'));
  try {
    const legacy = baseMeta({ reusableAssetTypes: undefined, assetKind: undefined, fiveV: undefined, layers: ['Part'], languages: ['JavaScript'], runtimes: ['Node.js 22+'] });
    await materializeLegacy(dir, legacy);
    await assert.rejects(
      () => validateAssetDirectory(dir),
      (error) => error?.code === 'MISSING_DIRECTORY'
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
