import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdmissionTicket, validateFactoryRequest, validateFactoryResult, validateGptReview } from '../src/chat-control-plane.js';

const commit = 'a'.repeat(40);
const manifest = 'b'.repeat(64);

function request(overrides = {}) {
  return {
    schema_version: 'modulecatalog.chat-factory-request.v1',
    request_id: 'req-20261002-001',
    repository: 'seigo-gace/modular-catalog',
    catalog_commit: commit,
    scope: 'full_snapshot',
    review_rule_version: 'gpt-final-review-v1',
    requested_by: 'gpt-chat',
    purpose: 'Prepare the exact snapshot for GPT final review.',
    ...overrides
  };
}

function result(overrides = {}) {
  return {
    schema_version: 'modulecatalog.chat-factory-result.v1',
    request_id: 'req-20261002-001',
    repository: 'seigo-gace/modular-catalog',
    catalog_commit: commit,
    manifest_sha256: manifest,
    asset_count: 80,
    knowledge_unit_count: 720,
    relationship_count: 80,
    case_count: 160,
    contract_unknown_count: 80,
    applicability_empty_count: 80,
    known_unverified_count: 0,
    layer_values: ['Feature'],
    architecture_review_required: true,
    real_cross_project_reuse_proven: false,
    factory_status: 'FACTORY_READY_FOR_GPT_REVIEW',
    ...overrides
  };
}

function review(decision = 'GPT_APPROVED', overrides = {}) {
  return {
    schema_version: 'modulecatalog.gpt-final-review.v1',
    request_id: 'req-20261002-001',
    repository: 'seigo-gace/modular-catalog',
    catalog_commit: commit,
    manifest_sha256: manifest,
    review_rule_version: 'gpt-final-review-v1',
    decision,
    findings: ['Exact snapshot reviewed against current authority.'],
    reviewed_by: 'gpt-chat',
    reviewed_at: '2026-10-02T12:00:00.000Z',
    ...overrides
  };
}

test('validates an exact Chat factory request', () => {
  const value = validateFactoryRequest(request());
  assert.equal(value.catalog_commit, commit);
  assert.equal(value.scope, 'full_snapshot');
});

test('rejects mutable or non-exact request revisions', () => {
  assert.throws(() => validateFactoryRequest(request({ catalog_commit: 'HEAD' })), (error) => error?.code === 'CHAT_FACTORY_REQUEST_INVALID');
});

test('validates a Factory result only when it is ready for GPT review', () => {
  const value = validateFactoryResult(result());
  assert.equal(value.asset_count, 80);
  assert.equal(value.factory_status, 'FACTORY_READY_FOR_GPT_REVIEW');
  assert.equal(value.real_cross_project_reuse_proven, false);
});

test('binds GPT review to the exact Factory result identity', () => {
  const value = validateGptReview(review(), result());
  assert.equal(value.decision, 'GPT_APPROVED');
  assert.throws(
    () => validateGptReview(review('GPT_APPROVED', { manifest_sha256: 'c'.repeat(64) }), result()),
    (error) => error?.code === 'GPT_FINAL_REVIEW_IDENTITY_MISMATCH'
  );
});

test('only GPT_APPROVED produces an admission ticket', () => {
  const approved = buildAdmissionTicket(review('GPT_APPROVED'), result(), { queuedAt: '2026-10-02T12:05:00.000Z' });
  assert.equal(approved.status, 'READY_FOR_RUNTIME_ADMISSION');
  assert.equal(approved.transport, 'master-pc-initiated-pull');
  assert.equal(approved.catalog_commit, commit);
  assert.equal(approved.manifest_sha256, manifest);
  assert.equal(buildAdmissionTicket(review('GPT_REJECTED'), result()), null);
  assert.equal(buildAdmissionTicket(review('GPT_HOLD'), result()), null);
});

test('rejects non-GPT review actors and unsupported decisions', () => {
  assert.throws(() => validateGptReview(review('GPT_APPROVED', { reviewed_by: 'workflow' }), result()), (error) => error?.code === 'GPT_FINAL_REVIEW_ACTOR_INVALID');
  assert.throws(() => validateGptReview(review('PASS'), result()), (error) => error?.code === 'GPT_FINAL_REVIEW_DECISION_INVALID');
});
