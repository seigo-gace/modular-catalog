import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CatalogError } from './catalog.js';
import { buildAdmissionTicket } from './chat-control-plane.js';
import { prepareKbOutbox } from './kb-outbox.js';

const TICKET_SCHEMA = 'modulecatalog.kb-admission-ticket.v1';
const CATALOG_REPOSITORY = 'seigo-gace/modular-catalog';
const EXPECTED_TRANSPORT = 'master-pc-initiated-pull';
const EXPECTED_KB_ROOT = 'F:\\G-ACE-KB';
const COMMIT_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

function fail(message, code, details = null) {
  const error = new CatalogError(message, code);
  if (details !== null) error.details = details;
  throw error;
}

function requiredString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) fail(`Admission ticket ${field} is required.`, 'RUNTIME_ADMISSION_TICKET_INVALID');
  return normalized;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function validateRuntimeAdmissionTicket(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Admission ticket must be an object.', 'RUNTIME_ADMISSION_TICKET_INVALID');
  if (input.schema_version !== TICKET_SCHEMA) fail('Admission ticket schema is unsupported.', 'RUNTIME_ADMISSION_TICKET_INVALID');
  if (input.repository !== CATALOG_REPOSITORY) fail('Admission ticket repository does not match ModuleCatalog.', 'RUNTIME_ADMISSION_TICKET_INVALID');
  if (input.review_decision !== 'GPT_APPROVED') fail('Only GPT_APPROVED admission tickets may reach runtime admission.', 'RUNTIME_ADMISSION_NOT_APPROVED');
  if (input.status !== 'READY_FOR_RUNTIME_ADMISSION') fail('Admission ticket is not ready for runtime admission.', 'RUNTIME_ADMISSION_NOT_READY');
  if (input.transport !== EXPECTED_TRANSPORT) fail('Admission ticket transport is unsupported.', 'RUNTIME_ADMISSION_TRANSPORT_INVALID');
  if (input.kb_root !== EXPECTED_KB_ROOT) fail('Admission ticket KB root is not the fixed G-ACE KB root.', 'RUNTIME_ADMISSION_KB_ROOT_INVALID');

  const catalogCommit = requiredString(input.catalog_commit, 'catalog_commit').toLowerCase();
  const manifestSha256 = requiredString(input.manifest_sha256, 'manifest_sha256').toLowerCase();
  if (!COMMIT_RE.test(catalogCommit)) fail('Admission ticket catalog_commit must be an exact 40-character Git commit.', 'RUNTIME_ADMISSION_TICKET_INVALID');
  if (!SHA256_RE.test(manifestSha256)) fail('Admission ticket manifest_sha256 must be a SHA-256 digest.', 'RUNTIME_ADMISSION_TICKET_INVALID');
  const queuedAt = requiredString(input.queued_at, 'queued_at');
  if (Number.isNaN(Date.parse(queuedAt))) fail('Admission ticket queued_at must be an ISO timestamp.', 'RUNTIME_ADMISSION_TICKET_INVALID');

  return Object.freeze({
    schema_version: TICKET_SCHEMA,
    request_id: requiredString(input.request_id, 'request_id'),
    repository: CATALOG_REPOSITORY,
    catalog_commit: catalogCommit,
    manifest_sha256: manifestSha256,
    review_rule_version: requiredString(input.review_rule_version, 'review_rule_version'),
    review_decision: 'GPT_APPROVED',
    status: 'READY_FOR_RUNTIME_ADMISSION',
    transport: EXPECTED_TRANSPORT,
    server_outbox_root: requiredString(input.server_outbox_root, 'server_outbox_root'),
    kb_root: EXPECTED_KB_ROOT,
    queued_at: queuedAt
  });
}

export function validateRuntimeAdmissionBundle({ ticket: ticketInput, review, result }) {
  const ticket = validateRuntimeAdmissionTicket(ticketInput);
  let rebuilt;
  try {
    rebuilt = buildAdmissionTicket(review, result, { queuedAt: review?.reviewed_at });
  } catch (error) {
    fail('Runtime admission bundle failed the source machine/GPT admission gates.', 'RUNTIME_ADMISSION_CONTROL_EVIDENCE_INVALID', { cause: error?.code ?? error?.message ?? String(error) });
  }
  if (!rebuilt) fail('Runtime admission bundle does not rebuild to an approved ticket.', 'RUNTIME_ADMISSION_CONTROL_EVIDENCE_INVALID');
  if (canonicalJson(rebuilt) !== canonicalJson(ticket)) {
    fail('Runtime admission ticket does not match the ticket rebuilt from Factory result and GPT review.', 'RUNTIME_ADMISSION_TICKET_REBUILD_MISMATCH');
  }
  return ticket;
}

function currentGitState(rootDir) {
  let head;
  let status;
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim().toLowerCase();
    status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: rootDir, encoding: 'utf8' });
  } catch (error) {
    fail('Runtime admission could not resolve the ModuleCatalog Git state.', 'RUNTIME_ADMISSION_GIT_STATE_UNAVAILABLE', { cause: error?.message ?? String(error) });
  }
  return { head, dirty: status.split(/\r?\n/).filter(Boolean) };
}

export async function executeRuntimeAdmission(rootDir, bundleInput) {
  const root = path.resolve(rootDir);
  const ticket = validateRuntimeAdmissionBundle(bundleInput);
  const git = currentGitState(root);
  if (git.head !== ticket.catalog_commit) {
    fail('Runtime checkout does not match the approved Catalog commit.', 'RUNTIME_ADMISSION_COMMIT_MISMATCH', { expected: ticket.catalog_commit, actual: git.head });
  }
  if (git.dirty.length) {
    fail('Runtime checkout must be clean before approved admission.', 'RUNTIME_ADMISSION_WORKTREE_DIRTY', { entries: git.dirty.slice(0, 20), truncated: git.dirty.length > 20 });
  }

  const sealed = await prepareKbOutbox(root, ticket.server_outbox_root, {
    expectedCatalogCommit: ticket.catalog_commit,
    expectedManifestSha256: ticket.manifest_sha256
  });
  if (sealed.summary.catalogCommit !== ticket.catalog_commit || sealed.summary.manifestSha256 !== ticket.manifest_sha256) {
    fail('Sealed delivery readback does not match the approved ticket identity.', 'RUNTIME_ADMISSION_READBACK_MISMATCH');
  }

  return Object.freeze({
    status: 'SEALED_FOR_MASTER_PC_PULL',
    request_id: ticket.request_id,
    catalog_commit: ticket.catalog_commit,
    manifest_sha256: ticket.manifest_sha256,
    outbox_path: sealed.outboxPath,
    idempotent: sealed.idempotent,
    transport: ticket.transport,
    kb_root: ticket.kb_root
  });
}

async function readJson(file, label) {
  try {
    return JSON.parse(await fs.readFile(path.resolve(file), 'utf8'));
  } catch (error) {
    fail(`${label} could not be read as JSON.`, 'RUNTIME_ADMISSION_CONTROL_FILE_INVALID', { cause: error?.message ?? String(error) });
  }
}

export async function executeRuntimeAdmissionFiles(rootDir, { ticketFile, reviewFile, resultFile }) {
  return executeRuntimeAdmission(rootDir, {
    ticket: await readJson(ticketFile, 'Admission ticket file'),
    review: await readJson(reviewFile, 'GPT review file'),
    result: await readJson(resultFile, 'Factory result file')
  });
}
