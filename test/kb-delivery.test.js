import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sha256 } from '../src/catalog.js';
import { exportReusableAssets } from '../src/reusable-asset-export.js';
import { preflightDelivery, publishDelivery, verifyKbActive } from '../src/kb-delivery.js';

const root = process.cwd();
const ASSET_ID = 'approval-route-resolver';
const COMMIT_A = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const COMMIT_B = (COMMIT_A[0] === 'b' ? 'a' : 'b') + COMMIT_A.slice(1);

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

async function makeKbRoot() {
  const kbRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-kb-'));
  const inboxBase = path.join(kbRoot, 'data', 'knowledge-inbox', 'modulecatalog');
  for (const name of ['ready', 'processing', 'processed', 'failed']) {
    await fs.mkdir(path.join(inboxBase, name), { recursive: true });
  }
  await fs.mkdir(path.join(kbRoot, 'data', 'knowledge-intake', 'modulecatalog', 'receipts'), { recursive: true });
  await fs.mkdir(path.join(kbRoot, 'data', 'knowledge-records'), { recursive: true });
  return { kbRoot, inboxBase };
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function rebindDeliveryCommit(deliveryRoot, targetCommit) {
  const topFile = path.join(deliveryRoot, 'manifest.json');
  const top = JSON.parse(await fs.readFile(topFile, 'utf8'));
  top.catalog.commit = targetCommit;

  for (const item of top.assets) {
    const assetDir = path.join(deliveryRoot, 'assets', item.id);
    const assetFile = path.join(assetDir, 'asset.json');
    const asset = JSON.parse(await fs.readFile(assetFile, 'utf8'));
    asset.provenance.catalog.commit = targetCommit;
    await writeJson(assetFile, asset);

    const manifestFile = path.join(assetDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
    manifest.catalog.commit = targetCommit;
    for (const fileEntry of manifest.files) {
      const bytes = await fs.readFile(path.join(assetDir, fileEntry.path));
      fileEntry.size = bytes.length;
      fileEntry.sha256 = sha256(bytes);
    }
    manifest.bundle_hash = sha256(canonicalJson(manifest.files));
    item.bundleHash = manifest.bundle_hash;
    await writeJson(manifestFile, manifest);
  }

  await writeJson(topFile, top);
}

function stateFrom(expected, status = 'ACTIVE') {
  return {
    schemaVersion: 1,
    status,
    catalogRepository: 'seigo-gace/modular-catalog',
    catalogCommit: expected.catalogCommit,
    assetCount: expected.assetCount,
    knowledgeUnitCount: expected.knowledgeUnitCount,
    relationshipCount: expected.relationshipCount,
    caseCount: expected.caseCount,
    deliveryManifestSha256: expected.manifestSha256
  };
}

test('KB activation preflight requires a full current Catalog snapshot', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-partial-'));
  try {
    await exportReusableAssets(root, work, { assetId: ASSET_ID, catalogCommit: COMMIT_A });
    await assert.rejects(
      () => preflightDelivery(root, work),
      (error) => error?.code === 'KB_DELIVERY_NOT_FULL_SNAPSHOT'
    );
    const partial = await preflightDelivery(root, work, { requireFullSnapshot: false });
    assert.equal(partial.assetCount, 1);
    assert.equal(partial.caseCount, 2);
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
});

test('preflights and atomically publishes exactly one complete full snapshot', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-delivery-'));
  const deliveryA = path.join(work, 'delivery-a');
  const deliveryB = path.join(work, 'delivery-b');
  const { kbRoot, inboxBase } = await makeKbRoot();
  try {
    await exportReusableAssets(root, deliveryA, { catalogCommit: COMMIT_A });
    await fs.cp(deliveryA, deliveryB, { recursive: true });
    await rebindDeliveryCommit(deliveryB, COMMIT_B);

    const checked = await preflightDelivery(root, deliveryA);
    assert.equal(checked.catalogCommit, COMMIT_A);
    assert.equal(checked.assetCount, 80);
    assert.equal(checked.knowledgeUnitCount, 720);
    assert.equal(checked.caseCount, 160);
    assert.equal(checked.relationshipCount >= 720, true);

    const checkedB = await preflightDelivery(root, deliveryB);
    assert.equal(checkedB.catalogCommit, COMMIT_B);

    const published = await publishDelivery(root, deliveryA, kbRoot);
    assert.equal(published.status, 'PUBLISHED');
    assert.equal(published.idempotent, false);
    assert.equal(await fs.stat(path.join(inboxBase, 'ready', COMMIT_A, 'manifest.json')).then(() => true), true);

    const repeated = await publishDelivery(root, deliveryA, kbRoot);
    assert.equal(repeated.status, 'PUBLISHED');
    assert.equal(repeated.idempotent, true);

    await assert.rejects(
      () => publishDelivery(root, deliveryB, kbRoot),
      (error) => error?.code === 'KB_READY_OCCUPIED'
    );
  } finally {
    await fs.rm(work, { recursive: true, force: true });
    await fs.rm(kbRoot, { recursive: true, force: true });
  }
});

test('does not queue another activation candidate while KB processing is occupied', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-busy-'));
  const delivery = path.join(work, 'delivery');
  const { kbRoot, inboxBase } = await makeKbRoot();
  try {
    await exportReusableAssets(root, delivery, { catalogCommit: COMMIT_A });
    await fs.mkdir(path.join(inboxBase, 'processing', 'other-delivery'), { recursive: true });
    await assert.rejects(
      () => publishDelivery(root, delivery, kbRoot),
      (error) => error?.code === 'KB_RECEIVER_BUSY'
    );
    assert.equal((await fs.readdir(path.join(inboxBase, 'ready'))).length, 0);
  } finally {
    await fs.rm(work, { recursive: true, force: true });
    await fs.rm(kbRoot, { recursive: true, force: true });
  }
});

test('detects same-commit delivery identity conflict before republishing', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-identity-'));
  const delivery = path.join(work, 'delivery');
  const variant = path.join(work, 'variant');
  const { kbRoot } = await makeKbRoot();
  try {
    await exportReusableAssets(root, delivery, { catalogCommit: COMMIT_A });
    const expected = await preflightDelivery(root, delivery);
    await fs.cp(delivery, variant, { recursive: true });
    const variantManifestFile = path.join(variant, 'manifest.json');
    const variantManifest = JSON.parse(await fs.readFile(variantManifestFile, 'utf8'));
    variantManifest.producer_note = 'same semantic snapshot, different delivery manifest bytes';
    await writeJson(variantManifestFile, variantManifest);
    const changed = await preflightDelivery(root, variant);
    assert.notEqual(changed.manifestSha256, expected.manifestSha256);

    const receiptFile = path.join(kbRoot, 'data', 'knowledge-intake', 'modulecatalog', 'receipts', `${COMMIT_A}.json`);
    await writeJson(receiptFile, stateFrom(expected, 'ACCEPTED'));
    await assert.rejects(
      () => publishDelivery(root, variant, kbRoot),
      (error) => error?.code === 'KB_DELIVERY_IDENTITY_CONFLICT'
    );
  } finally {
    await fs.rm(work, { recursive: true, force: true });
    await fs.rm(kbRoot, { recursive: true, force: true });
  }
});

test('treats ACCEPTED as pending and requires matching ACTIVE receipt plus current authority', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-active-'));
  const delivery = path.join(work, 'delivery');
  const { kbRoot } = await makeKbRoot();
  try {
    await exportReusableAssets(root, delivery, { catalogCommit: COMMIT_A });
    const expected = await preflightDelivery(root, delivery);
    const receiptFile = path.join(kbRoot, 'data', 'knowledge-intake', 'modulecatalog', 'receipts', `${COMMIT_A}.json`);
    const currentFile = path.join(kbRoot, 'data', 'knowledge-records', 'modulecatalog-reusable-active.json');

    await writeJson(receiptFile, stateFrom(expected, 'ACCEPTED'));
    const accepted = await verifyKbActive(root, delivery, kbRoot);
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.code, 'KB_ACCEPTED_PENDING_ACTIVE');

    await writeJson(receiptFile, stateFrom(expected, 'ACTIVE'));
    await writeJson(currentFile, stateFrom(expected, 'ACTIVE'));
    const complete = await verifyKbActive(root, delivery, kbRoot);
    assert.equal(complete.status, 'COMPLETE');
    assert.equal(complete.summary.catalogCommit, COMMIT_A);

    await writeJson(currentFile, { ...stateFrom(expected, 'ACTIVE'), catalogCommit: COMMIT_B });
    await assert.rejects(
      () => verifyKbActive(root, delivery, kbRoot),
      (error) => error?.code === 'KB_STALE_REDELIVERY_REJECTED'
    );
  } finally {
    await fs.rm(work, { recursive: true, force: true });
    await fs.rm(kbRoot, { recursive: true, force: true });
  }
});
