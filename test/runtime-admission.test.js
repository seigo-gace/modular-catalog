import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { preflightDelivery } from '../src/kb-delivery.js';
import { exportReusableAssets } from '../src/reusable-asset-export.js';
import { executeRuntimeAdmission, validateRuntimeAdmissionTicket } from '../src/runtime-admission.js';

const root = process.cwd();

function ticket({ commit, manifest, outbox, ...overrides }) {
  return {
    schema_version: 'modulecatalog.kb-admission-ticket.v1',
    request_id: 'req-runtime-admission-001',
    repository: 'seigo-gace/modular-catalog',
    catalog_commit: commit,
    manifest_sha256: manifest,
    review_rule_version: 'gpt-final-review-v2',
    review_decision: 'GPT_APPROVED',
    status: 'READY_FOR_RUNTIME_ADMISSION',
    transport: 'master-pc-initiated-pull',
    server_outbox_root: outbox,
    kb_root: 'F:\\G-ACE-KB',
    queued_at: '2026-10-02T19:36:19Z',
    ...overrides
  };
}

test('validates only the fixed approved runtime-admission contract', () => {
  const commit = 'a'.repeat(40);
  const manifest = 'b'.repeat(64);
  const value = validateRuntimeAdmissionTicket(ticket({ commit, manifest, outbox: '/tmp/modulecatalog-outbox' }));
  assert.equal(value.catalog_commit, commit);
  assert.equal(value.manifest_sha256, manifest);
  assert.throws(
    () => validateRuntimeAdmissionTicket(ticket({ commit, manifest, outbox: '/tmp/modulecatalog-outbox', review_decision: 'GPT_HOLD' })),
    (error) => error?.code === 'RUNTIME_ADMISSION_NOT_APPROVED'
  );
  assert.throws(
    () => validateRuntimeAdmissionTicket(ticket({ commit, manifest, outbox: '/tmp/modulecatalog-outbox', transport: 'github-push-to-pc' })),
    (error) => error?.code === 'RUNTIME_ADMISSION_TRANSPORT_INVALID'
  );
});

test('runtime admission seals only the exact approved commit and manifest identity', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-runtime-admission-'));
  const snapshot = path.join(temp, 'snapshot');
  const outbox = path.join(temp, 'outbox');
  await fs.mkdir(outbox);
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().toLowerCase();
    await exportReusableAssets(root, snapshot, { catalogCommit: commit });
    const expected = await preflightDelivery(root, snapshot);

    await assert.rejects(
      () => executeRuntimeAdmission(root, ticket({ commit, manifest: '0'.repeat(64), outbox })),
      (error) => error?.code === 'KB_OUTBOX_EXPECTED_MANIFEST_MISMATCH'
    );
    await assert.rejects(
      () => fs.stat(path.join(outbox, commit)),
      (error) => error?.code === 'ENOENT'
    );

    const sealed = await executeRuntimeAdmission(root, ticket({ commit, manifest: expected.manifestSha256, outbox }));
    assert.equal(sealed.status, 'SEALED_FOR_MASTER_PC_PULL');
    assert.equal(sealed.catalog_commit, commit);
    assert.equal(sealed.manifest_sha256, expected.manifestSha256);
    assert.equal(sealed.idempotent, false);
    assert.equal((await fs.stat(path.join(outbox, commit))).isDirectory(), true);

    const repeat = await executeRuntimeAdmission(root, ticket({ commit, manifest: expected.manifestSha256, outbox }));
    assert.equal(repeat.idempotent, true);
  } finally {
    await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test('runtime admission rejects a different checkout identity before outbox mutation', async () => {
  const outbox = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-runtime-outbox-'));
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().toLowerCase();
    const otherCommit = (commit[0] === '0' ? '1' : '0') + commit.slice(1);
    await assert.rejects(
      () => executeRuntimeAdmission(root, ticket({ commit: otherCommit, manifest: 'b'.repeat(64), outbox })),
      (error) => error?.code === 'RUNTIME_ADMISSION_COMMIT_MISMATCH'
    );
    assert.deepEqual(await fs.readdir(outbox), []);
  } finally {
    await fs.rm(outbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
