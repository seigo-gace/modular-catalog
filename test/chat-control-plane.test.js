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
    review_rule_version: 'gpt-final-review-v2',
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
    portable_reuse_boundary: 'Copied assets passed recorded normal/user Node tests outside the Catalog tree; unrelated-project integration remains unproven.',
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
    review_rule_version: 'gpt-final-review-v2',
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
  assert.equal(value.review_rule_version, 'gpt-final-review-v2');
  assert.equal(value.factory_status, 'FACTORY_READY_FOR_GPT_REVIEW');
  assert.equal(value.applicability_from_canonical_purpose_count, 30);
  assert.equal(value.applicability_from_interface_count, 50);
  assert.equal(value.applicability_unknown_derivation_count, 0);
  assert.equal(value.module_architecture_layer_gate_pass, true);
  assert.equal(value.portable_reuse_smoke_proven, true);
  assert.equal(value.portable_reuse_asset_count, 80);
  assert.equal(value.real_cross_project_reuse_proven, false);
});

test('binds GPT review to exact Factory result identity and review-rule version', () => {
  const value = validateGptReview(review(), result());
  assert.equal(value.decision, 'GPT_APPROVED');
  assert.throws(
    () => validateGptReview(review('GPT_APPROVED', { manifest_sha256: 'c'.repeat(64) }), result()),
    (error) => error?.code === 'GPT_FINAL_REVIEW_IDENTITY_MISMATCH'
  );
  assert.throws(
    () => validateGptReview(review('GPT_APPROVED', { review_rule_version: 'other-rule' }), result()),
    (error) => error?.code === 'GPT_FINAL_REVIEW_IDENTITY_MISMATCH'
  );
});

test('only GPT_APPROVED with all machine gates produces an admission ticket', () => {
  const approved = buildAdmissionTicket(review('GPT_APPROVED'), result(), { queuedAt: '2026-10-02T12:05:00.000Z' });
  assert.equal(approved.status, 'READY_FOR_RUNTIME_ADMISSION');
  assert.equal(approved.transport, 'master-pc-initiated-pull');
  assert.equal(approved.catalog_commit, commit);
  assert.equal(approved.manifest_sha256, manifest);
  assert.equal(buildAdmissionTicket(review('GPT_REJECTED'), result()), null);
  assert.equal(buildAdmissionTicket(review('GPT_HOLD'), result()), null);
});

test('GPT approval cannot bypass mandatory machine admission gates', () => {
  for (const bad of [
    { contract_unknown_count: 1 },
    { applicability_empty_count: 1 },
    { applicability_unknown_derivation_count: 1 },
    { applicability_from_canonical_purpose_count: 29, applicability_from_interface_count: 50 },
    { known_unverified_count: 1 },
    { module_architecture_layer_gate_pass: false },
    { invalid_layer_values: ['LayerX'] },
    { portable_reuse_smoke_proven: false },
    { portable_reuse_asset_count: 79 },
    { portable_reuse_command_count: 159 }
  ]) {
    assert.throws(
      () => buildAdmissionTicket(review('GPT_APPROVED'), result(bad)),
      (error) => error?.code === 'KB_ADMISSION_MACHINE_GATES_FAILED'
    );
  }
  assert.equal(buildAdmissionTicket(review('GPT_HOLD'), result({ contract_unknown_count: 80 })), null);
});

test('rejects non-GPT review actors, empty findings and unsupported decisions', () => {
  assert.throws(() => validateGptReview(review('GPT_APPROVED', { reviewed_by: 'workflow' }), result()), (error) => error?.code === 'GPT_FINAL_REVIEW_ACTOR_INVALID');
  assert.throws(() => validateGptReview(review('GPT_APPROVED', { findings: [] }), result()), (error) => error?.code === 'GPT_FINAL_REVIEW_FINDINGS_REQUIRED');
  assert.throws(() => validateGptReview(review('PASS'), result()), (error) => error?.code === 'GPT_FINAL_REVIEW_DECISION_INVALID');
});
