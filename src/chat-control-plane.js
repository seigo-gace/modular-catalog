const CATALOG_REPOSITORY = 'seigo-gace/modular-catalog';
const REQUEST_SCHEMA = 'modulecatalog.chat-factory-request.v1';
const RESULT_SCHEMA = 'modulecatalog.chat-factory-result.v1';
const REVIEW_SCHEMA = 'modulecatalog.gpt-final-review.v1';
const TICKET_SCHEMA = 'modulecatalog.kb-admission-ticket.v1';
const DECISIONS = new Set(['GPT_APPROVED', 'GPT_REJECTED', 'GPT_HOLD']);
const COMMIT_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

function fail(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details !== null) error.details = details;
  throw error;
}

function object(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`, code);
  return value;
}

function string(value, label, code) {
  const normalized = String(value ?? '').trim();
  if (!normalized) fail(`${label} is required.`, code);
  return normalized;
}

function requestId(value, label, code) {
  const normalized = string(value, label, code);
  if (!REQUEST_ID_RE.test(normalized)) fail(`${label} format is invalid.`, code);
  return normalized;
}

function exactCommit(value, label, code) {
  const normalized = string(value, label, code).toLowerCase();
  if (!COMMIT_RE.test(normalized)) fail(`${label} must be an exact 40-character Git commit.`, code);
  return normalized;
}

function sha256(value, label, code) {
  const normalized = string(value, label, code).toLowerCase();
  if (!SHA256_RE.test(normalized)) fail(`${label} must be a SHA-256 hex digest.`, code);
  return normalized;
}

function strings(value, label, code) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) fail(`${label} must be a string array.`, code);
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function integer(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a non-negative integer.`, code);
  return value;
}

function isoTimestamp(value, label, code) {
  const normalized = string(value, label, code);
  if (Number.isNaN(Date.parse(normalized))) fail(`${label} must be an ISO timestamp.`, code);
  return normalized;
}

export function validateFactoryRequest(input) {
  const value = object(input, 'Factory request', 'CHAT_FACTORY_REQUEST_INVALID');
  if (value.schema_version !== REQUEST_SCHEMA) fail('Factory request schema is unsupported.', 'CHAT_FACTORY_REQUEST_SCHEMA_INVALID');
  if (value.repository !== CATALOG_REPOSITORY) fail('Factory request repository is invalid.', 'CHAT_FACTORY_REQUEST_REPOSITORY_MISMATCH');
  if (value.scope !== 'full_snapshot') fail('Factory request scope must be full_snapshot.', 'CHAT_FACTORY_REQUEST_SCOPE_INVALID');
  if (value.requested_by !== 'gpt-chat') fail('Factory request requested_by must be gpt-chat.', 'CHAT_FACTORY_REQUEST_ACTOR_INVALID');
  return Object.freeze({
    schema_version: REQUEST_SCHEMA,
    request_id: requestId(value.request_id, 'request_id', 'CHAT_FACTORY_REQUEST_INVALID'),
    repository: CATALOG_REPOSITORY,
    catalog_commit: exactCommit(value.catalog_commit, 'catalog_commit', 'CHAT_FACTORY_REQUEST_INVALID'),
    scope: 'full_snapshot',
    review_rule_version: string(value.review_rule_version, 'review_rule_version', 'CHAT_FACTORY_REQUEST_INVALID'),
    requested_by: 'gpt-chat',
    purpose: string(value.purpose, 'purpose', 'CHAT_FACTORY_REQUEST_INVALID')
  });
}

export function validateFactoryResult(input) {
  const value = object(input, 'Factory result', 'CHAT_FACTORY_RESULT_INVALID');
  if (value.schema_version !== RESULT_SCHEMA) fail('Factory result schema is unsupported.', 'CHAT_FACTORY_RESULT_SCHEMA_INVALID');
  if (value.repository !== CATALOG_REPOSITORY) fail('Factory result repository is invalid.', 'CHAT_FACTORY_RESULT_REPOSITORY_MISMATCH');
  if (value.factory_status !== 'FACTORY_READY_FOR_GPT_REVIEW') fail('Factory result is not ready for GPT review.', 'CHAT_FACTORY_RESULT_NOT_READY');
  return Object.freeze({
    schema_version: RESULT_SCHEMA,
    request_id: requestId(value.request_id, 'request_id', 'CHAT_FACTORY_RESULT_INVALID'),
    repository: CATALOG_REPOSITORY,
    catalog_commit: exactCommit(value.catalog_commit, 'catalog_commit', 'CHAT_FACTORY_RESULT_INVALID'),
    manifest_sha256: sha256(value.manifest_sha256, 'manifest_sha256', 'CHAT_FACTORY_RESULT_INVALID'),
    review_rule_version: string(value.review_rule_version, 'review_rule_version', 'CHAT_FACTORY_RESULT_INVALID'),
    asset_count: integer(value.asset_count, 'asset_count', 'CHAT_FACTORY_RESULT_INVALID'),
    knowledge_unit_count: integer(value.knowledge_unit_count, 'knowledge_unit_count', 'CHAT_FACTORY_RESULT_INVALID'),
    relationship_count: integer(value.relationship_count, 'relationship_count', 'CHAT_FACTORY_RESULT_INVALID'),
    case_count: integer(value.case_count, 'case_count', 'CHAT_FACTORY_RESULT_INVALID'),
    contract_unknown_count: integer(value.contract_unknown_count, 'contract_unknown_count', 'CHAT_FACTORY_RESULT_INVALID'),
    applicability_empty_count: integer(value.applicability_empty_count, 'applicability_empty_count', 'CHAT_FACTORY_RESULT_INVALID'),
    known_unverified_count: integer(value.known_unverified_count, 'known_unverified_count', 'CHAT_FACTORY_RESULT_INVALID'),
    layer_values: strings(value.layer_values, 'layer_values', 'CHAT_FACTORY_RESULT_INVALID'),
    architecture_review_required: value.architecture_review_required === true,
    real_cross_project_reuse_proven: value.real_cross_project_reuse_proven === true,
    factory_status: 'FACTORY_READY_FOR_GPT_REVIEW'
  });
}

export function validateGptReview(input, factoryResult) {
  const result = validateFactoryResult(factoryResult);
  const value = object(input, 'GPT review', 'GPT_FINAL_REVIEW_INVALID');
  if (value.schema_version !== REVIEW_SCHEMA) fail('GPT review schema is unsupported.', 'GPT_FINAL_REVIEW_SCHEMA_INVALID');
  const decision = string(value.decision, 'decision', 'GPT_FINAL_REVIEW_INVALID');
  if (!DECISIONS.has(decision)) fail('GPT review decision is invalid.', 'GPT_FINAL_REVIEW_DECISION_INVALID');
  if (value.repository !== CATALOG_REPOSITORY) fail('GPT review repository is invalid.', 'GPT_FINAL_REVIEW_REPOSITORY_MISMATCH');
  const findings = strings(value.findings, 'findings', 'GPT_FINAL_REVIEW_INVALID');
  if (!findings.length) fail('GPT review must record at least one finding.', 'GPT_FINAL_REVIEW_FINDINGS_REQUIRED');
  const review = Object.freeze({
    schema_version: REVIEW_SCHEMA,
    request_id: requestId(value.request_id, 'request_id', 'GPT_FINAL_REVIEW_INVALID'),
    repository: CATALOG_REPOSITORY,
    catalog_commit: exactCommit(value.catalog_commit, 'catalog_commit', 'GPT_FINAL_REVIEW_INVALID'),
    manifest_sha256: sha256(value.manifest_sha256, 'manifest_sha256', 'GPT_FINAL_REVIEW_INVALID'),
    review_rule_version: string(value.review_rule_version, 'review_rule_version', 'GPT_FINAL_REVIEW_INVALID'),
    decision,
    findings,
    reviewed_by: string(value.reviewed_by, 'reviewed_by', 'GPT_FINAL_REVIEW_INVALID'),
    reviewed_at: isoTimestamp(value.reviewed_at, 'reviewed_at', 'GPT_FINAL_REVIEW_INVALID')
  });
  if (review.reviewed_by !== 'gpt-chat') fail('GPT review reviewed_by must be gpt-chat.', 'GPT_FINAL_REVIEW_ACTOR_INVALID');
  if (review.request_id !== result.request_id || review.catalog_commit !== result.catalog_commit || review.manifest_sha256 !== result.manifest_sha256 || review.review_rule_version !== result.review_rule_version) {
    fail('GPT review identity does not match the Factory result.', 'GPT_FINAL_REVIEW_IDENTITY_MISMATCH');
  }
  return review;
}

export function buildAdmissionTicket(reviewInput, factoryResult, { queuedAt } = {}) {
  const result = validateFactoryResult(factoryResult);
  const review = validateGptReview(reviewInput, result);
  if (review.decision !== 'GPT_APPROVED') return null;
  return Object.freeze({
    schema_version: TICKET_SCHEMA,
    request_id: review.request_id,
    repository: CATALOG_REPOSITORY,
    catalog_commit: review.catalog_commit,
    manifest_sha256: review.manifest_sha256,
    review_rule_version: review.review_rule_version,
    review_decision: review.decision,
    status: 'READY_FOR_RUNTIME_ADMISSION',
    transport: 'master-pc-initiated-pull',
    server_outbox_root: '/home/admin1/logs/modulecatalog/outbox',
    kb_root: 'F:\\G-ACE-KB',
    queued_at: isoTimestamp(queuedAt ?? new Date().toISOString(), 'queued_at', 'KB_ADMISSION_TICKET_INVALID')
  });
}

export const CHAT_CONTROL_SCHEMAS = Object.freeze({
  request: REQUEST_SCHEMA,
  result: RESULT_SCHEMA,
  review: REVIEW_SCHEMA,
  ticket: TICKET_SCHEMA
});
