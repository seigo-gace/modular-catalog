import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildAdmissionTicket } from '../src/chat-control-plane.js';
import { prepareKbOutbox } from '../src/kb-outbox.js';
import { validateRuntimeAdmissionBundle, validateRuntimeAdmissionTicket, executeRuntimeAdmission } from '../src/runtime-admission.js';

const root = process.cwd();
const fixedOutbox = '/home/admin1/logs/modulecatalog/outbox';

function factoryResult({ commit = 'a'.repeat(40), manifest = 'b'.repeat(64), ...overrides } = {}) {
  return {
    schema_version: 'modulecatalog.chat-factory-result.v1',
    request_id: 'req-runtime-admission-001',
    repository: 'seigo-gace/modular-catalog',
    catalog_commit: commit,
    manifest_sha256: manifest,
    review_rule_version: 'gpt-final-review-v2',
    asset_count: 80,
    knowledge_unit_count: 720,
    relationship_count: 720,
    case_count: 160,
    contract_unknown_count: 0,
    applicability_empty_count: 0,
    applicability_from_canonical_purpose_count: 30,
    applicability_from_interface_count: 50,
    applicability_unknown_derivation_count: 0,
    known_unverified_count: 0,
    layer_values: ['Component', 'Part'],
    invalid_layer_values: [],
    module_architecture_layer_gate_pass: true,
    architecture_review_required: true,
    portable_reuse_smoke_proven: true,
    portable_reuse_asset_count: 80,
    portable_reuse_command_count: 160,
    portable_reuse_boundary: 'Portable reuse smoke only; unrelated-project integration remains unproven.',
    real_cross_project_reuse_proven: false,
    factory_status: 'FACTORY_READY_FOR_GPT_REVIEW',
    ...overrides
  };
}

function review({ commit = 'a'.repeat(40), manifest = 'b'.repeat(64), ...overrides } = {}) {
  return {
    schema_version: 'modulecatalog.gpt-final-review.v1',
    request_id: 'req-runtime-admission-001',
    repository: 'seigo-gace/modular-catalog',
    catalog_commit: commit,
    manifest_sha256: manifest,
    review_rule_version: 'gpt-final-review-v2',
    decision: 'GPT_APPROVED',
    findings: ['Exact snapshot reviewed and approved with explicit unproven cross-project boundary.'],
    reviewed_by: 'gpt-chat',
    reviewed_at: '2026-10-02T19:36:19Z',
    ...overrides
  };
}

function approvedBundle({ commit = 'a'.repeat(40), manifest = 'b'.repeat(64), resultOverrides = {}, reviewOverrides = {}, ticketOverrides = {} } = {}) {
  const result = factoryResult({ commit, manifest, ...resultOverrides });
  const checkedReview = review({ commit, manifest, ...reviewOverrides });
  const ticket = { ...buildAdmissionTicket(checkedReview, result, { queuedAt: checkedReview.reviewed_at }), ...ticketOverrides };
  return { ticket, review: checkedReview, result };
}

test('validates only the fixed approved runtime-admission ticket contract', () => {
  const bundle = approvedBundle();
  const value = validateRuntimeAdmissionTicket(bundle.ticket);
  assert.equal(value.catalog_commit, 'a'.repeat(40));
  assert.equal(value.server_outbox_root, fixedOutbox);
  assert.throws(
    () => validateRuntimeAdmissionTicket({ ...bundle.ticket, review_decision: 'GPT_HOLD' }),
    (error) => error?.code === 'RUNTIME_ADMISSION_NOT_APPROVED'
  );
  assert.throws(
    () => validateRuntimeAdmissionTicket({ ...bundle.ticket, server_outbox_root: '/tmp/other-outbox' }),
    (error) => error?.code === 'RUNTIME_ADMISSION_OUTBOX_ROOT_INVALID'
  );
});

test('runtime rebuilds the approved ticket from Factory result and GPT review', () => {
  const bundle = approvedBundle();
  assert.equal(validateRuntimeAdmissionBundle(bundle).manifest_sha256, 'b'.repeat(64));
  assert.throws(
    () => validateRuntimeAdmissionBundle({ ...bundle, ticket: { ...bundle.ticket, manifest_sha256: 'c'.repeat(64) } }),
    (error) => error?.code === 'RUNTIME_ADMISSION_TICKET_REBUILD_MISMATCH'
  );
  assert.throws(
    () => validateRuntimeAdmissionBundle(approvedBundle({ resultOverrides: { contract_unknown_count: 1 } })),
    (error) => error?.code === 'RUNTIME_ADMISSION_CONTROL_EVIDENCE_INVALID'
  );
});

test('runtime rejects a different checkout identity before any server outbox mutation', async () => {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().toLowerCase();
  const otherCommit = (commit[0] === '0' ? '1' : '0') + commit.slice(1);
  await assert.rejects(
    () => executeRuntimeAdmission(root, approvedBundle({ commit: otherCommit })),
    (error) => error?.code === 'RUNTIME_ADMISSION_COMMIT_MISMATCH'
  );
});

test('outbox refuses an approved expected-manifest mismatch before sealing a final revision directory', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-runtime-outbox-'));
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().toLowerCase();
    await assert.rejects(
      () => prepareKbOutbox(root, temp, { expectedCatalogCommit: commit, expectedManifestSha256: '0'.repeat(64) }),
      (error) => error?.code === 'KB_OUTBOX_EXPECTED_MANIFEST_MISMATCH'
    );
    assert.equal((await fs.readdir(temp)).some((name) => name === commit), false);
  } finally {
    await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
