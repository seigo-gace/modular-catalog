import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createManifest } from '../src/catalog.js';
import { exportReusableAssets } from '../src/reusable-asset-export.js';

const projectRoot = process.cwd();

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

async function prepareCatalogSchema(catalog) {
  await fs.mkdir(path.join(catalog, 'schemas'), { recursive: true });
  await fs.copyFile(
    path.join(projectRoot, 'schemas', 'reusable-asset-v1.schema.json'),
    path.join(catalog, 'schemas', 'reusable-asset-v1.schema.json')
  );
}

function initializeGit(catalog, message) {
  git(catalog, ['init']);
  git(catalog, ['config', 'user.name', 'ModuleCatalog Test']);
  git(catalog, ['config', 'user.email', 'modulecatalog-test@example.invalid']);
  git(catalog, ['add', '-A']);
  git(catalog, ['commit', '-m', message]);
  return git(catalog, ['rev-parse', 'HEAD']);
}

test('reusable export accepts the registered Asset contract without an optional README and rejects dirty provenance', async () => {
  const catalog = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-minimal-catalog-'));
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-minimal-export-'));
  const output = path.join(outputRoot, 'out');
  try {
    await prepareCatalogSchema(catalog);
    const assetDir = path.join(catalog, 'assets', 'minimal-no-readme');
    await write(path.join(assetDir, 'meta.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'minimal-no-readme',
      name: 'Minimal No README',
      version: '1.0.0',
      summary: 'Minimal registered asset contract.',
      purpose: 'Prove README is not an admission requirement.',
      responsibility: 'Expose a verified minimal operation.',
      layers: ['Feature'],
      languages: ['JavaScript'],
      runtimes: ['Node.js 22'],
      tags: ['fixture'],
      dependencies: [],
      constraints: ['no direct mutation authority'],
      source: { repository: 'example/minimal', commit: 'a'.repeat(40) },
      verifiedAt: '2026-10-02T00:00:00.000Z'
    }, null, 2) + '\n');
    await write(path.join(assetDir, 'design.md'), '# Design\nquasar-design-marker\n');
    await write(path.join(assetDir, 'logic.md'), '# Logic\nnebula-logic-marker\n');
    await write(path.join(assetDir, 'architecture.md'), '# Architecture\npulsar-architecture-marker\n');
    await write(path.join(assetDir, 'evidence.json'), JSON.stringify({
      normal: { passed: true, commands: ['node tests/normal/run.cjs'], expectedResults: ['normal pass'] },
      user: { passed: true, commands: ['node tests/user/run.cjs'], expectedResults: ['user pass'] }
    }, null, 2) + '\n');
    await write(path.join(assetDir, 'source', 'index.js'), 'export function run(value) { return value; }\n');
    await write(path.join(assetDir, 'tests', 'normal', 'run.cjs'), "require('node:assert/strict').equal(1, 1);\n");
    await write(path.join(assetDir, 'tests', 'user', 'run.cjs'), "require('node:assert/strict').equal('ok', 'ok');\n");
    const manifest = await createManifest(assetDir);
    await write(path.join(assetDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

    const catalogCommit = initializeGit(catalog, 'minimal catalog fixture');
    const result = await exportReusableAssets(catalog, output, { assetId: 'minimal-no-readme', catalogCommit });
    assert.equal(result.assetCount, 1);
    assert.equal(result.assets[0].knowledgeUnits, 8);

    const asset = JSON.parse(await fs.readFile(path.join(output, 'assets', 'minimal-no-readme', 'asset.json'), 'utf8'));
    const units = (await fs.readFile(path.join(output, 'assets', 'minimal-no-readme', 'knowledge-units.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(units.some((unit) => unit.knowledge_id.endsWith('::readme')), false);
    assert.equal(asset.derivation.canonical_sources.includes('README.md'), false);
    assert.equal(asset.discovery.keywords.includes('quasar-design-marker'), true);
    assert.equal(asset.discovery.keywords.includes('nebula-logic-marker'), true);
    assert.equal(asset.discovery.keywords.includes('pulsar-architecture-marker'), true);

    await write(path.join(assetDir, 'design.md'), '# Design\nworking-tree-only-change\n');
    await assert.rejects(
      () => exportReusableAssets(catalog, output, { assetId: 'minimal-no-readme', catalogCommit }),
      (error) => error?.code === 'CATALOG_WORKTREE_DIRTY' && Array.isArray(error?.details?.entries)
    );
  } finally {
    await fs.rm(catalog, { recursive: true, force: true });
    await fs.rm(outputRoot, { recursive: true, force: true });
  }
});

test('pure design export omits unrecorded logic architecture and code instead of fabricating them', async () => {
  const catalog = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-pure-design-catalog-'));
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-pure-design-export-'));
  const output = path.join(outputRoot, 'out');
  try {
    await prepareCatalogSchema(catalog);
    const assetDir = path.join(catalog, 'assets', 'pure-design-asset');
    await write(path.join(assetDir, 'meta.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'pure-design-asset',
      name: 'Pure Design Asset',
      version: '1.0.0',
      summary: 'Reusable design without unrelated content padding.',
      purpose: 'Reuse one verified design decision.',
      responsibility: 'Preserve the design and its verified usage boundary.',
      layers: [],
      languages: [],
      runtimes: [],
      tags: ['design', 'reusable'],
      dependencies: [],
      constraints: [],
      reusableAssetTypes: ['design'],
      assetKind: 'design',
      fiveV: { applicable: false, verificationBasis: ['design.md', 'tests/normal/review.txt', 'tests/user/use.txt'] },
      source: { repository: 'example/pure-design', commit: 'b'.repeat(40) },
      verifiedAt: '2026-10-03T00:00:00.000Z'
    }, null, 2) + '\n');
    await write(path.join(assetDir, 'design.md'), '# Design\nverified-pure-design-marker\n');
    await write(path.join(assetDir, 'evidence.json'), JSON.stringify({
      normal: { passed: true, commands: ['design-review'], expectedResults: ['PASS'] },
      user: { passed: true, commands: ['design-use'], expectedResults: ['PASS'] }
    }, null, 2) + '\n');
    await write(path.join(assetDir, 'tests', 'normal', 'review.txt'), 'PASS\n');
    await write(path.join(assetDir, 'tests', 'user', 'use.txt'), 'PASS\n');
    const manifest = await createManifest(assetDir);
    await write(path.join(assetDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

    const catalogCommit = initializeGit(catalog, 'pure design fixture');
    const result = await exportReusableAssets(catalog, output, { assetId: 'pure-design-asset', catalogCommit });
    assert.equal(result.assetCount, 1);
    assert.equal(result.assets[0].knowledgeUnits, 4);

    const asset = JSON.parse(await fs.readFile(path.join(output, 'assets', 'pure-design-asset', 'asset.json'), 'utf8'));
    const units = (await fs.readFile(path.join(output, 'assets', 'pure-design-asset', 'knowledge-units.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(asset.reusability.asset_types, ['design']);
    assert.equal(asset.reusability.five_v.status, 'not_applicable');
    assert.deepEqual(asset.implementation.source_files, []);
    assert.equal(asset.derivation.canonical_sources.includes('design.md'), true);
    assert.equal(asset.derivation.canonical_sources.includes('logic.md'), false);
    assert.equal(asset.derivation.canonical_sources.includes('architecture.md'), false);
    assert.equal(asset.derivation.canonical_sources.includes('source/'), false);
    assert.equal(units.some((unit) => unit.knowledge_kind === 'design'), true);
    assert.equal(units.some((unit) => unit.knowledge_kind === 'logic'), false);
    assert.equal(units.some((unit) => unit.knowledge_kind === 'architecture'), false);
    assert.equal(units.some((unit) => unit.knowledge_kind === 'code'), false);
  } finally {
    await fs.rm(catalog, { recursive: true, force: true });
    await fs.rm(outputRoot, { recursive: true, force: true });
  }
});
