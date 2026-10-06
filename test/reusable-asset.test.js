import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportReusableAssets } from '../src/reusable-asset-export.js';
import { assertReusableAssetSchema, createReusableAssetValidator } from '../src/reusable-asset-schema.js';

const root = process.cwd();
const VALID_LAYERS = new Set(['Part', 'Feature', 'Component', 'System', 'Application System']);

test('exports the full current catalog as reusable asset bundles without inventing missing fields', async () => {
  const schema = JSON.parse(await fs.readFile(path.join(root, 'schemas/reusable-asset-v1.schema.json'), 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.$id, 'urn:gace:modular-catalog:reusable-asset:v1');
  assert.deepEqual(schema.required, ['schema_version', 'identity', 'classification', 'discovery', 'applicability', 'contract', 'composition', 'implementation', 'verification', 'provenance', 'lifecycle', 'integrity', 'derivation']);

  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'modular-catalog-export-'));
  const repeatOutput = await fs.mkdtemp(path.join(os.tmpdir(), 'modular-catalog-repeat-'));
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
    let knownContractCount = 0;
    let nonEmptyApplicabilityCount = 0;
    let interfaceDerivedApplicabilityCount = 0;

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
      assert.equal(asset.classification.layers.length > 0, true);
      assert.equal(asset.classification.layers.every((layer) => VALID_LAYERS.has(layer)), true);
      assert.equal(asset.applicability.use_when.length, 1);
      const applicabilityDerivation = asset.derivation.derived_fields.find((entry) => entry.field === 'applicability.use_when');
      assert.ok(applicabilityDerivation);
      if (applicabilityDerivation.source === 'meta.purpose') {
        assert.equal(asset.applicability.use_when[0], asset.discovery.purpose);
      } else {
        assert.equal(applicabilityDerivation.source.includes('meta.purpose is generic'), true);
        assert.equal(asset.applicability.use_when[0].startsWith('Use when the required call interface matches '), true);
        assert.equal(asset.contract.inputs.length > 0, true);
        assert.equal(asset.contract.outputs.length > 0, true);
        interfaceDerivedApplicabilityCount += 1;
      }
      if (asset.contract.status === 'known') knownContractCount += 1;
      if (['use_when', 'do_not_use_when', 'preconditions', 'required_context', 'failure_conditions'].some((field) => asset.applicability[field].length > 0)) nonEmptyApplicabilityCount += 1;
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
    assert.equal(nonEmptyApplicabilityCount, 80);
    assert.equal(interfaceDerivedApplicabilityCount, 50);
    assert.equal(knownContractCount, 80);

    const approvalAsset = JSON.parse(await fs.readFile(path.join(output, 'assets', 'approval-route-resolver', 'asset.json'), 'utf8'));
    assert.equal(approvalAsset.identity.symbol, 'run');
    assert.deepEqual(approvalAsset.discovery.capabilities, []);
    assert.equal(approvalAsset.contract.status, 'known');
    assert.equal(approvalAsset.contract.inputs.some((value) => typeof value === 'string' && value.startsWith('run(') && value.includes('action') && value.includes('risk') && value.includes('capability')), true);
    assert.equal(approvalAsset.contract.outputs.some((value) => typeof value === 'string' && value.startsWith('run -> ') && value.includes('status')), true);
    assert.equal(approvalAsset.contract.mutation_authority, false);
    assert.equal(approvalAsset.contract.error_behavior.includes('Fail closed on structurally invalid input.'), true);
    assert.equal(approvalAsset.contract.side_effects, 'Do not execute side effects.');
    assert.deepEqual(approvalAsset.applicability.use_when, ['Resolve an approval route from explicit action, risk, capability and policy rules.']);
    assert.deepEqual(approvalAsset.applicability.do_not_use_when, []);
    assert.deepEqual(approvalAsset.applicability.preconditions, []);
    assert.equal(approvalAsset.applicability.required_context.some((value) => value.startsWith('run(')), true);
    assert.equal(approvalAsset.applicability.failure_conditions.includes('Fail closed on structurally invalid input.'), true);
    assert.deepEqual(approvalAsset.composition.requires, []);
    assert.equal(approvalAsset.derivation.derived_fields.some((entry) => entry.field === 'identity.symbol' && entry.type === 'deterministic-derived'), true);
    assert.equal(approvalAsset.derivation.derived_fields.some((entry) => entry.field === 'contract.inputs' && entry.type === 'deterministic-derived'), true);
    assert.equal(approvalAsset.derivation.derived_fields.some((entry) => entry.field === 'contract.outputs' && entry.type === 'deterministic-derived'), true);
    assert.equal(approvalAsset.derivation.derived_fields.some((entry) => entry.field === 'contract.status' && entry.type === 'deterministic-derived'), true);
    assert.equal(approvalAsset.derivation.derived_fields.some((entry) => entry.field === 'applicability.use_when' && entry.source === 'meta.purpose'), true);
    assert.equal(approvalAsset.derivation.derived_fields.some((entry) => entry.field === 'discovery.capabilities'), false);

    const topManifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
    assert.equal(topManifest.assetCount, 80);
    assert.equal(topManifest.assets.length, 80);
    assert.equal(Object.hasOwn(topManifest, 'generatedAt'), false);

    const repeatAssetId = result.assets[0].id;
    const firstRepeat = await exportReusableAssets(root, repeatOutput, { assetId: repeatAssetId, catalogCommit: commit });
    const firstRepeatManifest = await fs.readFile(path.join(repeatOutput, 'manifest.json'), 'utf8');
    const secondRepeat = await exportReusableAssets(root, repeatOutput, { assetId: repeatAssetId, catalogCommit: commit });
    const secondRepeatManifest = await fs.readFile(path.join(repeatOutput, 'manifest.json'), 'utf8');
    assert.deepEqual(secondRepeat, firstRepeat);
    assert.equal(secondRepeatManifest, firstRepeatManifest);

    const wrongCommit = (commit[0] === '0' ? '1' : '0') + commit.slice(1);
    await assert.rejects(
      () => exportReusableAssets(root, repeatOutput, { assetId: repeatAssetId, catalogCommit: wrongCommit }),
      (error) => error?.code === 'CATALOG_REVISION_MISMATCH'
    );

    const validator = await createReusableAssetValidator(root);
    const validAsset = JSON.parse(await fs.readFile(path.join(output, 'assets', repeatAssetId, 'asset.json'), 'utf8'));
    assert.equal(validator.validate(validAsset).valid, true);
    const invalidAsset = structuredClone(validAsset);
    invalidAsset.identity.asset_id = '';
    assert.throws(
      () => assertReusableAssetSchema(validator, invalidAsset, repeatAssetId),
      (error) => error?.code === 'REUSABLE_ASSET_SCHEMA_INVALID'
    );
  } finally {
    await fs.rm(output, { recursive: true, force: true });
    await fs.rm(repeatOutput, { recursive: true, force: true });
  }
});

test('export-reusable-assets CLI is wired and requires an explicit output directory', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'modular-catalog-cli-'));
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const cli = spawnSync(process.execPath, [
      'src/cli.js',
      'export-reusable-assets',
      'approval-route-resolver',
      '--output', output,
      '--catalog-commit', commit,
      '--json'
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    const result = JSON.parse(cli.stdout);
    assert.equal(result.assetCount, 1);
    assert.equal(result.assets[0].id, 'approval-route-resolver');
    assert.equal(result.catalog.commit, commit);
    assert.equal(await fs.stat(path.join(output, 'manifest.json')).then(() => true), true);

    const missingOutput = spawnSync(process.execPath, [
      'src/cli.js',
      'export-reusable-assets',
      'approval-route-resolver',
      '--catalog-commit', commit
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(missingOutput.status, 1);
    const error = JSON.parse(missingOutput.stderr.trim());
    assert.equal(error.code, 'MISSING_ARGUMENT');
  } finally {
    await fs.rm(output, { recursive: true, force: true });
  }
});
