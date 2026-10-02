import { execFile as execFileCallback } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { CatalogError } from './catalog.js';
import { executeRuntimeAdmission, validateRuntimeAdmissionBundle } from './runtime-admission.js';

const execFile = promisify(execFileCallback);
const REPOSITORY = 'seigo-gace/modular-catalog';
const CONTROL_BRANCH = 'control/modulecatalog-chat-orchestration-v1';
const FINALIZATION_BRANCH = 'feat/reusable-knowledge-factory-v1-20261002';
const GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;
const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/i;

function fail(message, code, details = null) {
  const error = new CatalogError(message, code);
  if (details !== null) error.details = details;
  throw error;
}

function safeRequestId(value) {
  const id = String(value ?? '').trim();
  if (!REQUEST_ID_RE.test(id)) fail('Admission queue request id is invalid.', 'RUNTIME_ADMISSION_QUEUE_REQUEST_INVALID');
  return id;
}

function headers() {
  return { Accept: 'application/vnd.github+json', 'User-Agent': 'gace-modulecatalog-runtime-admission' };
}

async function fetchApiJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, { headers: headers() });
  } catch (error) {
    fail('GitHub admission control fetch failed.', 'RUNTIME_ADMISSION_QUEUE_FETCH_FAILED', { cause: error?.message ?? String(error) });
  }
  if (!response.ok) fail('GitHub admission control fetch returned a non-success status.', 'RUNTIME_ADMISSION_QUEUE_FETCH_FAILED', { status: response.status, url });
  return response.json();
}

export async function fetchCurrentFinalizationHead(fetchImpl = globalThis.fetch) {
  const url = `${GITHUB_API}/git/ref/heads/${FINALIZATION_BRANCH}`;
  const payload = await fetchApiJson(url, fetchImpl);
  const sha = String(payload?.object?.sha ?? '').trim().toLowerCase();
  if (!COMMIT_RE.test(sha)) fail('Current Catalog finalization branch HEAD is invalid.', 'CATALOG_FINALIZATION_HEAD_INVALID', { branch: FINALIZATION_BRANCH, value: sha || null });
  return sha;
}

export async function assertCurrentFinalizationCommit(catalogCommit, fetchImpl = globalThis.fetch) {
  const expected = String(catalogCommit ?? '').trim().toLowerCase();
  if (!COMMIT_RE.test(expected)) fail('Catalog finalization commit is invalid.', 'CATALOG_FINALIZATION_COMMIT_INVALID');
  const current = await fetchCurrentFinalizationHead(fetchImpl);
  if (expected !== current) {
    fail('Approved Catalog data is stale because the finalization branch has advanced.', 'CATALOG_FINALIZATION_STALE_COMMIT', {
      branch: FINALIZATION_BRANCH,
      approved_commit: expected,
      current_head: current
    });
  }
  return current;
}

export async function listAdmissionRequestIds(fetchImpl = globalThis.fetch) {
  const url = `${GITHUB_API}/contents/.gace-control/admission-queue?ref=${encodeURIComponent(CONTROL_BRANCH)}`;
  const items = await fetchApiJson(url, fetchImpl);
  if (!Array.isArray(items)) fail('Admission queue listing is not an array.', 'RUNTIME_ADMISSION_QUEUE_FORMAT_INVALID');
  return items
    .filter((item) => item?.type === 'file' && typeof item.name === 'string' && item.name.endsWith('.json'))
    .map((item) => item.name.slice(0, -5))
    .filter((id) => REQUEST_ID_RE.test(id))
    .sort();
}

async function fetchControlJson(relativePath, fetchImpl) {
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  const url = `${GITHUB_API}/contents/${encodedPath}?ref=${encodeURIComponent(CONTROL_BRANCH)}`;
  const payload = await fetchApiJson(url, fetchImpl);
  if (payload?.encoding !== 'base64' || typeof payload.content !== 'string') fail('GitHub control file response is not base64 content.', 'RUNTIME_ADMISSION_QUEUE_FORMAT_INVALID', { path: relativePath });
  try {
    return JSON.parse(Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8'));
  } catch (error) {
    fail('GitHub control file is not valid JSON.', 'RUNTIME_ADMISSION_QUEUE_FORMAT_INVALID', { path: relativePath, cause: error?.message ?? String(error) });
  }
}

export async function fetchAdmissionBundle(requestId, fetchImpl = globalThis.fetch) {
  const id = safeRequestId(requestId);
  const [ticket, review, result] = await Promise.all([
    fetchControlJson(`.gace-control/admission-queue/${id}.json`, fetchImpl),
    fetchControlJson(`.gace-control/reviews/${id}.json`, fetchImpl),
    fetchControlJson(`.gace-control/results/${id}.json`, fetchImpl)
  ]);
  return Object.freeze({ ticket, review, result });
}

async function manifestState(ticket) {
  const finalPath = path.join(ticket.server_outbox_root, ticket.catalog_commit);
  const manifestPath = path.join(finalPath, 'manifest.json');
  let content;
  try {
    content = await fs.readFile(manifestPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: 'MISSING', finalPath };
    fail('Existing outbox manifest could not be read.', 'RUNTIME_ADMISSION_OUTBOX_READ_FAILED', { cause: error?.code ?? error?.message ?? String(error) });
  }
  const sha = crypto.createHash('sha256').update(content).digest('hex');
  if (sha !== ticket.manifest_sha256) fail('Existing outbox manifest conflicts with the approved ticket identity.', 'RUNTIME_ADMISSION_OUTBOX_IDENTITY_CONFLICT', { expected: ticket.manifest_sha256, actual: sha });
  return { state: 'MATCH', finalPath };
}

async function checkoutExactCommit(target, commit, execImpl = execFile) {
  await fs.mkdir(target, { recursive: true });
  await execImpl('git', ['init', target]);
  await execImpl('git', ['-C', target, 'remote', 'add', 'origin', `https://github.com/${REPOSITORY}.git`]);
  try {
    await execImpl('git', ['-C', target, 'fetch', '--no-tags', '--depth=1', 'origin', commit]);
  } catch {
    await execImpl('git', ['-C', target, 'fetch', '--no-tags', '--filter=blob:none', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
  }
  await execImpl('git', ['-C', target, 'checkout', '--detach', commit]);
  const resolved = (await execImpl('git', ['-C', target, 'rev-parse', 'HEAD'])).stdout.trim().toLowerCase();
  if (resolved !== commit) fail('Temporary runtime checkout does not match the approved commit.', 'RUNTIME_ADMISSION_CHECKOUT_MISMATCH', { expected: commit, actual: resolved });
}

export async function processAdmissionQueueOnce({ workRoot, requestId = null, fetchImpl = globalThis.fetch, execImpl = execFile } = {}) {
  if (!workRoot) fail('Runtime admission worker requires workRoot.', 'RUNTIME_ADMISSION_WORK_ROOT_REQUIRED');
  const base = path.resolve(workRoot);
  const receiptsRoot = path.join(base, 'receipts');
  const temporaryRoot = path.join(base, 'tmp');
  await fs.mkdir(receiptsRoot, { recursive: true });
  await fs.mkdir(temporaryRoot, { recursive: true });

  const ids = requestId ? [safeRequestId(requestId)] : await listAdmissionRequestIds(fetchImpl);
  const results = [];
  for (const id of ids) {
    const bundle = await fetchAdmissionBundle(id, fetchImpl);
    const ticket = validateRuntimeAdmissionBundle(bundle);
    await assertCurrentFinalizationCommit(ticket.catalog_commit, fetchImpl);
    const existing = await manifestState(ticket);
    if (existing.state === 'MATCH') {
      results.push({ request_id: id, status: 'ALREADY_SEALED_FOR_MASTER_PC_PULL', catalog_commit: ticket.catalog_commit, manifest_sha256: ticket.manifest_sha256, outbox_path: existing.finalPath });
      continue;
    }

    const temp = path.join(temporaryRoot, `${id}-${crypto.randomUUID()}`);
    const source = path.join(temp, 'source');
    try {
      await checkoutExactCommit(source, ticket.catalog_commit, execImpl);
      const sealed = await executeRuntimeAdmission(source, bundle);
      const receipt = { schema_version: 'modulecatalog.runtime-admission-receipt.v1', request_id: id, ...sealed, sealed_at: new Date().toISOString() };
      const receiptPath = path.join(receiptsRoot, `${id}.json`);
      await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
      results.push(receipt);
    } finally {
      await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
    }
  }
  return Object.freeze({ status: 'RUNTIME_ADMISSION_QUEUE_PROCESSED', processed: results.length, results });
}

export const RUNTIME_ADMISSION_CONTROL = Object.freeze({ repository: REPOSITORY, control_branch: CONTROL_BRANCH, finalization_branch: FINALIZATION_BRANCH });
