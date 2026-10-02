import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportReusableAssets } from '../src/reusable-asset-export.js';
import { preflightDelivery, publishDelivery, verifyKbActive } from '../src/kb-delivery.js';

const root = process.cwd();
const ASSET_ID = 'approval-route-resolver';
const COMMIT_A = 'a'.repeat(40);
const COMMIT_B = 'b'.repeat(40);

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

test('preflights, atomically publishes one delivery, and refuses a second ready snapshot', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-delivery-'));
  const deliveryA = path.join(work, 'delivery-a');
  const deliveryB = path.join(work, 'delivery-b');
  const deliveryVariant = path.join(work, 'delivery-variant');
  const { kbRoot, inboxBase } = await makeKbRoot();
  try {
    await exportReusableAssets(root, deliveryA, { assetId: ASSET_ID, catalogCommit: COMMIT_A });
    await exportReusableAssets(root, deliveryB, { assetId: ASSET_ID, catalogCommit: COMMIT_B });

    const checked = await preflightDelivery(root, deliveryA);
    assert.equal(checked.catalogCommit, COMMIT_A);
    assert.equal(checked.assetCount, 1);
    assert.equal(checked.knowledgeUnitCount > 0, true);
    assert.equal(checked.relationshipCount > 0, true);
    assert.equal(checked.caseCount, 2);

    const published = await publishDelivery(root, deliveryA, inboxBase);
    assert.equal(published.status, 'PUBLISHED');
    assert.equal(published.idempotent, false);
    assert.equal(published.deliveryId, COMMIT_A);
    assert.equal(await fs.stat(path.join(inboxBase, 'ready', COMMIT_A, 'manifest.json')).then(() => true), true);
    assert.equal((await fs.readdir(path.join(inboxBase, '.producer-publish'))).length, 0);

    const repeated = await publishDelivery(root, deliveryA, inboxBase);
    assert.equal(repeated.status, 'PUBLISHED');
    assert.equal(repeated.idempotent, true);

    await assert.rejects(
      () => publishDelivery(root, deliveryB, inboxBase),
      (error) => error?.code === 'KB_READY_OCCUPIED'
    );

    await fs.cp(deliveryA, deliveryVariant, { recursive: true });
    const variantManifestFile = path.join(deliveryVariant, 'manifest.json');
    const variantManifest = JSON.parse(await fs.readFile(variantManifestFile, 'utf8'));
    variantManifest.producer_note = 'same commit, different manifest identity';
    await writeJson(variantManifestFile, variantManifest);
    await preflightDelivery(root, deliveryVariant);
    await assert.rejects(
      () => publishDelivery(root, deliveryVariant, inboxBase),
      (error) => error?.code === 'KB_DELIVERY_IDENTITY_CONFLICT'
    );

    const claimed = path.join(inboxBase, 'processing', COMMIT_A);
    await fs.rename(path.join(inboxBase, 'ready', COMMIT_A), claimed);
    const processing = await publishDelivery(root, deliveryA, inboxBase);
    assert.equal(processing.status, 'PROCESSING');
    assert.equal(processing.idempotent, true);

    const missingBase = path.join(kbRoot, 'not-configured');
    await assert.rejects(
      () => publishDelivery(root, deliveryB, missingBase),
      (error) => error?.code === 'KB_DELIVERY_NOT_CONFIGURED'
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
    await exportReusableAssets(root, delivery, { assetId: ASSET_ID, catalogCommit: COMMIT_A });
    const expected = await preflightDelivery(root, delivery);
    const receiptFile = path.join(kbRoot, 'data', 'knowledge-intake', 'modulecatalog', 'receipts', `${COMMIT_A}.json`);
    const currentFile = path.join(kbRoot, 'data', 'knowledge-records', 'modulecatalog-reusable-active.json');
    const baseState = {
      schemaVersion: 1,
      catalogRepository: 'seigo-gace/modular-catalog',
      catalogCommit: COMMIT_A,
      assetCount: expected.assetCount,
      knowledgeUnitCount: expected.knowledgeUnitCount,
      relationshipCount: expected.relationshipCount,
      caseCount: expected.caseCount,
      deliveryManifestSha256: expected.manifestSha256.toUpperCase()
    };

    await writeJson(receiptFile, { ...baseState, status: 'ACCEPTED' });
    const accepted = await verifyKbActive(root, delivery, kbRoot);
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.code, 'KB_ACCEPTED_PENDING_ACTIVE');

    await writeJson(receiptFile, { ...baseState, status: 'ACTIVE' });
    await writeJson(currentFile, { ...baseState, status: 'ACTIVE' });
    const complete = await verifyKbActive(root, delivery, kbRoot);
    assert.equal(complete.status, 'COMPLETE');
    assert.equal(complete.catalogCommit, COMMIT_A);

    await writeJson(currentFile, { ...baseState, status: 'ACTIVE', catalogCommit: COMMIT_B });
    await assert.rejects(
      () => verifyKbActive(root, delivery, kbRoot),
      (error) => error?.code === 'KB_CURRENT_MISMATCH'
    );
  } finally {
    await fs.rm(work, { recursive: true, force: true });
    await fs.rm(kbRoot, { recursive: true, force: true });
  }
});
