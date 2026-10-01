import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportReusableAssets } from '../src/reusable-asset-export.js';

const root = process.cwd();

test('exports the full current catalog as reusable asset bundles without inventing missing fields', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'modular-catalog-export-'));
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const result = await exportReusableAssets(root, output, { catalogCommit: commit });

    assert.equal(result.format, 'gace.reusable-asset.v1');
    assert.equal(result.catalog.repository, 'seigo-gace/modular-catalog');
    assert.equal(result.catalog.commit, commit);
    assert.equal(result.assetCount, 80);
    assert.equal(result.assets.length, 80);
    assert.equal(new Set(result.assets.map((asset) => asset.id)).size, 80);

    let totalKnowledgeUnits = 0;
    let totalCases = 0;

    for (const item of result.assets) {
      const dir = path.join(output, 'assets', item.id);
      const asset = JSON.parse(await fs.readFile(path.join(dir, 'asset.json'), 'utf8'));
      const units = (await fs.readFile(path.join(dir, 'knowledge-units.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
      const cases = (await fs.readFile(path.join(dir, 'cases.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
      const bundleManifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));

      assert.equal(asset.schema_version, 1);
      assert.equal(asset.identity.asset_id, item.id);
      assert.equal(asset.provenance.catalog.commit, commit);
      assert.equal(asset.integrity.asset_hash, item.assetHash);
      assert.equal(asset.verification.status, 'verified');
      assert.equal(asset.contract.status, 'unknown');
      assert.deepEqual(asset.applicability.use_when, []);
      assert.deepEqual(asset.applicability.do_not_use_when, []);
      assert.deepEqual(asset.applicability.preconditions, []);
      assert.deepEqual(asset.applicability.required_context, []);
      assert.deepEqual(asset.applicability.failure_conditions, []);
      assert.equal(bundleManifest.source_asset_hash, item.assetHash);
      assert.equal(bundleManifest.bundle_hash, item.bundleHash);
      assert.equal(units.every((unit) => unit.parent_asset_id === item.id), true);
      assert.equal(cases.every((entry) => entry.parent_asset_id === item.id), true);
      assert.equal(cases.every((entry) => entry.result === 'PASS'), true);
      assert.equal(units.some((unit) => unit.knowledge_kind === 'code'), true);
      assert.equal(units.some((unit) => unit.knowledge_kind === 'test_case'), true);

      totalKnowledgeUnits += units.length;
      totalCases += cases.length;
    }

    assert.equal(totalKnowledgeUnits, 720);
    assert.equal(totalCases, 160);

    const topManifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
    assert.equal(topManifest.assetCount, 80);
    assert.equal(topManifest.assets.length, 80);
  } finally {
    await fs.rm(output, { recursive: true, force: true });
  }
});
