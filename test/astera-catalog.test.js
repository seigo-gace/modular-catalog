import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadAssetSection, searchCatalog, verifyIndex } from '../src/catalog.js';

const root = path.resolve('.');

test('AsteraをPartからApplication Systemまで27責務として登録する', async () => {
  const verified = await verifyIndex(root);
  assert.equal(verified.assetCount, 27);
  const parts = await searchCatalog(root, { query: 'Astera', layer: 'Part', limit: 50 });
  assert.equal(parts.length, 6);
  const application = await searchCatalog(root, { query: 'composition root', layer: 'Application System' });
  assert.equal(application[0].id, 'astera-v8-application-system');
});

test('設計・Logic・Architecture本文を同じCatalog検索で発見できる', async () => {
  const design = await searchCatalog(root, { query: 'G01 G38 Anchor Path', limit: 5 });
  assert.equal(design[0].id, 'astera-domain-lens-catalog');
  assert.ok(design[0].matchedSections.includes('design'));
  const logic = await searchCatalog(root, { query: '失敗を成功値へ変換しない', limit: 5 });
  assert.ok(logic[0].matchedSections.includes('logic'));
  const architecture = await searchCatalog(root, { query: '実行時依存', limit: 5 });
  assert.ok(architecture[0].matchedSections.includes('architecture'));
});

test('検索後にSource・設計・Logic・Architectureを選択取得できる', async () => {
  const source = await loadAssetSection(root, 'astera-safe-json-processing', 'source');
  assert.deepEqual(Object.keys(source), ['source/src/safe-json.js']);
  const all = await loadAssetSection(root, 'astera-safe-json-processing', 'all');
  for (const required of ['design.md', 'logic.md', 'architecture.md', 'source/src/safe-json.js']) assert.ok(required in all);
});
