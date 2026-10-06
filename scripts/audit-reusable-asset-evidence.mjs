#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateAssetDirectory } from '../src/catalog.js';

const root = path.resolve(process.argv[2] ?? process.cwd());
const assetsRoot = path.join(root, 'assets');
const ids = (await fs.readdir(assetsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => entry.name)
  .sort();

async function countFiles(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) count += await countFiles(full);
      else if (entry.isFile()) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

const assets = [];
for (const id of ids) {
  const dir = path.join(assetsRoot, id);
  const { meta, evidence } = await validateAssetDirectory(dir, { verifyManifest: true });
  const sourceDir = await fs.stat(path.join(dir, 'source')).then(() => path.join(dir, 'source')).catch(async () =>
    await fs.stat(path.join(dir, 'code')).then(() => path.join(dir, 'code')).catch(() => null));
  const explicitTypes = Array.isArray(meta.reusableAssetTypes) ? [...new Set(meta.reusableAssetTypes.map((value) => String(value).trim()).filter(Boolean))] : [];
  const explicitFiveV = meta.fiveV && typeof meta.fiveV === 'object' && !Array.isArray(meta.fiveV) ? meta.fiveV : null;
  assets.push({
    asset_id: id,
    canonical_asset_kind: typeof meta.assetKind === 'string' && meta.assetKind.trim() ? meta.assetKind.trim() : null,
    canonical_reusable_asset_types: explicitTypes,
    reusable_asset_type_status: explicitTypes.length ? 'CANONICAL_RECORDED' : 'REVIEW_REQUIRED',
    five_v_status: explicitFiveV ? 'CANONICAL_RECORDED' : 'NOT_RECORDED',
    five_v_applicable: explicitFiveV?.applicable ?? null,
    five_v_level: explicitFiveV?.level ?? null,
    five_v_composed_from: Array.isArray(explicitFiveV?.composedFrom) ? explicitFiveV.composedFrom : [],
    legacy_layers_context_only: meta.layers,
    languages: meta.languages,
    runtimes: meta.runtimes,
    tags: meta.tags,
    source_file_count: sourceDir ? await countFiles(sourceDir) : 0,
    normal_test_file_count: await countFiles(path.join(dir, 'tests', 'normal')),
    user_test_file_count: await countFiles(path.join(dir, 'tests', 'user')),
    design_recorded: (await fs.stat(path.join(dir, 'design.md')).catch(() => null))?.size > 0,
    logic_recorded: (await fs.stat(path.join(dir, 'logic.md')).catch(() => null))?.size > 0,
    architecture_recorded: (await fs.stat(path.join(dir, 'architecture.md')).catch(() => null))?.size > 0,
    normal_evidence_passed: evidence?.normal?.passed === true,
    user_evidence_passed: evidence?.user?.passed === true,
    evidence_boundary: 'Observed repository facts only. legacy_layers_context_only is never promoted to reusable type or 5V level by this audit.'
  });
}

const countBy = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))));
const report = {
  schema_version: 1,
  audit_kind: 'modulecatalog.reusable-asset-evidence-audit.v1',
  asset_count: assets.length,
  reusable_asset_type_status_counts: countBy(assets.map((asset) => asset.reusable_asset_type_status)),
  five_v_status_counts: countBy(assets.map((asset) => asset.five_v_status)),
  source_file_presence_counts: countBy(assets.map((asset) => asset.source_file_count > 0 ? 'HAS_SOURCE' : 'NO_SOURCE')),
  verification_counts: countBy(assets.map((asset) => asset.normal_evidence_passed && asset.user_evidence_passed ? 'NORMAL_USER_PASS' : 'NOT_FULLY_VERIFIED')),
  rules: {
    no_legacy_layer_to_five_v_promotion: true,
    no_unrecorded_reusable_asset_type_inference: true,
    no_unrecorded_five_v_inference: true,
    preserve_existing_asset_identity_and_content: true
  },
  assets
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
