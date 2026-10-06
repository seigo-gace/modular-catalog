import { CatalogError } from './catalog.js';

const ALLOWED_SEVERITIES = new Set(['error', 'warn', 'info', 'debug', 'trace']);

function requiredString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new CatalogError(`${field} is required.`, 'TGS_INPUT_INVALID');
  return normalized;
}

function normalizeHit(hit, projectId) {
  if (!hit || typeof hit !== 'object' || Array.isArray(hit)) return null;
  const hitProjectId = String(hit.project_id ?? '').trim();
  const severity = String(hit.severity ?? '').trim();
  const timestamp = String(hit.timestamp ?? '').trim();
  const message = typeof hit.message === 'string' ? hit.message : '';
  if (hitProjectId !== projectId || !ALLOWED_SEVERITIES.has(severity) || !timestamp || Number.isNaN(Date.parse(timestamp)) || !message) return null;
  return Object.freeze({
    id: hit.id == null ? null : String(hit.id),
    project_id: hitProjectId,
    severity,
    timestamp,
    message,
    hash: hit.hash == null ? null : String(hit.hash),
    telegram_message_id: Number.isInteger(hit.telegram_message_id) ? hit.telegram_message_id : null
  });
}

export function normalizeTgserverZeroArtifact({ meta, result, expected_repo, expected_stream } = {}) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new CatalogError('TGserver ZERO meta artifact is required.', 'TGS_ZERO_ARTIFACT_INVALID');
  if (!result || typeof result !== 'object' || Array.isArray(result) || !Array.isArray(result.hits)) throw new CatalogError('TGserver ZERO result artifact must contain hits[].', 'TGS_ZERO_ARTIFACT_INVALID');
  const repo = requiredString(meta.repo, 'tgserver_zero.meta.repo');
  const stream = requiredString(meta.stream, 'tgserver_zero.meta.stream');
  const projectId = requiredString(meta.project_id, 'tgserver_zero.meta.project_id');
  const generation = requiredString(meta.generation, 'tgserver_zero.meta.generation');
  const expectedRepo = requiredString(expected_repo, 'tgserver_zero.expected_repo');
  const expectedStream = requiredString(expected_stream, 'tgserver_zero.expected_stream');
  if (generation !== 'TGserver ZERO') throw new CatalogError(`Unsupported TGserver generation: ${generation}`, 'TGS_ZERO_ARTIFACT_INVALID');
  if (repo !== expectedRepo) throw new CatalogError(`TGserver ZERO repo mismatch: expected ${expectedRepo}, got ${repo}`, 'TGS_ZERO_SCOPE_MISMATCH');
  if (stream !== expectedStream) throw new CatalogError(`TGserver ZERO stream mismatch: expected ${expectedStream}, got ${stream}`, 'TGS_ZERO_SCOPE_MISMATCH');
  if (!/^P\d+$/.test(projectId)) throw new CatalogError(`Invalid TGserver ZERO project_id: ${projectId}`, 'TGS_ZERO_ARTIFACT_INVALID');
  const normalizedHits = result.hits.map((hit) => normalizeHit(hit, projectId));
  if (normalizedHits.some((hit) => hit === null)) throw new CatalogError('TGserver ZERO result contains an invalid or out-of-scope hit.', 'TGS_ZERO_ARTIFACT_INVALID');
  const hits = normalizedHits;
  return Object.freeze({
    source: 'TGSERVER_ZERO_CENTRAL_READER_ARTIFACT',
    generation,
    repo,
    stream,
    project_id: projectId,
    purpose: String(meta.purpose ?? ''),
    hits: Object.freeze(hits),
    returned: hits.length,
    estimatedTotalHits: Number.isFinite(result.estimatedTotalHits) ? result.estimatedTotalHits : null
  });
}
