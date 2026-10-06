#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateAssetDirectory } from '../src/catalog.js';
import { buildReusableAssetProfile } from '../src/reusable-asset-profile.js';

const root = path.resolve(process.argv[2] ?? process.cwd());
const assetsRoot = path.join(root, 'assets');
const entries = (await fs.readdir(assetsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => entry.name)
  .sort();

function classification(meta) {
  if (meta.assetKind) return { value: meta.assetKind, mode: 'canonical', source: 'meta.assetKind' };
  if (meta.tags.includes('skill')) return { value: 'capability', mode: 'deterministic-derived', source: 'meta.tags contains skill' };
  return { value: 'unknown', mode: 'not-recorded', source: 'no explicit asset kind or skill tag' };
}

const rows = [];
for (const id of entries) {
  const { meta, evidence } = await validateAssetDirectory(path.join(assetsRoot, id), { verifyManifest: true });
  const primary = classification(meta);
  const profile = buildReusableAssetProfile({ meta, classification: primary, evidence }).value;
  rows.push({
    asset_id: id,
    primary_type: profile.primary_type,
    asset_types: profile.asset_types,
    five_v_status: profile.five_v.status,
    five_v_level: profile.five_v.level,
    five_v_composed_from: profile.five_v.composed_from,
    legacy_layers: meta.layers
  });
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

const assetTypeCounts = new Map();
for (const row of rows) {
  if (row.asset_types.length === 0) assetTypeCounts.set('NOT_RECORDED', (assetTypeCounts.get('NOT_RECORDED') ?? 0) + 1);
  for (const type of row.asset_types) assetTypeCounts.set(type, (assetTypeCounts.get(type) ?? 0) + 1);
}

const report = {
  schema_version: 1,
  asset_count: rows.length,
  primary_type_counts: countBy(rows.map((row) => row.primary_type)),
  reusable_asset_type_counts: Object.fromEntries([...assetTypeCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
  five_v_status_counts: countBy(rows.map((row) => row.five_v_status)),
  five_v_level_counts: countBy(rows.map((row) => row.five_v_level ?? 'NOT_RECORDED')),
  rules: {
    legacy_layers_are_not_auto_promoted_to_five_v: true,
    non_code_assets_can_remain_five_v_not_applicable: true,
    missing_asset_type_is_not_invented: true
  },
  assets: rows
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
