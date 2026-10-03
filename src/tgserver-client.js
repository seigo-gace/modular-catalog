import { CatalogError } from './catalog.js';

const ALLOWED_SEVERITIES = new Set(['error', 'warn', 'info', 'debug', 'trace']);

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new CatalogError(`${field} is required.`, 'TGS_INPUT_INVALID');
  return normalized;
}

function optionalIso(value, field) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) throw new CatalogError(`${field} must be an ISO8601 date/time.`, 'TGS_INPUT_INVALID');
  return normalized;
}

function normalizeHit(hit) {
  if (!hit || typeof hit !== 'object' || Array.isArray(hit)) return null;
  const projectId = String(hit.project_id ?? '').trim();
  const severity = String(hit.severity ?? '').trim();
  const timestamp = String(hit.timestamp ?? '').trim();
  const message = typeof hit.message === 'string' ? hit.message : '';
  if (!projectId || !ALLOWED_SEVERITIES.has(severity) || !timestamp || Number.isNaN(Date.parse(timestamp)) || !message) return null;
  return Object.freeze({
    id: hit.id == null ? null : String(hit.id),
    project_id: projectId,
    severity,
    timestamp,
    message,
    hash: hit.hash == null ? null : String(hit.hash),
    telegram_message_id: Number.isInteger(hit.telegram_message_id) ? hit.telegram_message_id : null
  });
}

function hitMatchesRequest(hit, { projectId, severity, fromIso, toIso }) {
  if (hit.project_id !== projectId) return false;
  if (severity && hit.severity !== severity) return false;
  const time = Date.parse(hit.timestamp);
  if (fromIso && time < Date.parse(fromIso)) return false;
  if (toIso && time > Date.parse(toIso)) return false;
  return true;
}

export function createTgserverClient({
  baseUrl = process.env.MODULECATALOG_TGS_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = positiveInteger(process.env.MODULECATALOG_TGS_TIMEOUT_MS, 10000),
  maxHits = positiveInteger(process.env.MODULECATALOG_TGS_MAX_HITS, 100)
} = {}) {
  if (!baseUrl) throw new CatalogError('MODULECATALOG_TGS_URL is required.', 'TGS_NOT_CONFIGURED');
  if (typeof fetchImpl !== 'function') throw new CatalogError('TGserver client requires fetch.', 'TGS_NOT_CONFIGURED');
  const endpoint = new URL('/search', baseUrl).toString();

  async function search({ query = '', project_id, severity, from, to } = {}) {
    const projectId = requiredString(project_id, 'project_id');
    const normalizedSeverity = severity == null || severity === '' ? undefined : String(severity).trim();
    if (normalizedSeverity && !ALLOWED_SEVERITIES.has(normalizedSeverity)) throw new CatalogError(`Unsupported TGserver severity: ${normalizedSeverity}`, 'TGS_INPUT_INVALID');
    const fromIso = optionalIso(from, 'from');
    const toIso = optionalIso(to, 'to');
    if (fromIso && toIso && Date.parse(fromIso) > Date.parse(toIso)) throw new CatalogError('TGserver from must not be after to.', 'TGS_INPUT_INVALID');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: String(query ?? ''),
          project_id: projectId,
          ...(normalizedSeverity ? { severity: normalizedSeverity } : {}),
          ...(fromIso ? { from: fromIso } : {}),
          ...(toIso ? { to: toIso } : {})
        }),
        signal: controller.signal
      });
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new CatalogError('TGserver returned invalid JSON.', 'TGS_INVALID_RESPONSE');
      }
      if (!response.ok) throw new CatalogError(`TGserver search failed with HTTP ${response.status}.`, 'TGS_REQUEST_FAILED');
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.hits)) {
        throw new CatalogError('TGserver search response must contain hits[].', 'TGS_INVALID_RESPONSE');
      }
      const requestBoundary = { projectId, severity: normalizedSeverity, fromIso, toIso };
      const hits = body.hits.map(normalizeHit).filter(Boolean).filter((hit) => hitMatchesRequest(hit, requestBoundary)).slice(0, maxHits);
      return Object.freeze({
        project_id: projectId,
        query: String(query ?? ''),
        severity: normalizedSeverity ?? null,
        from: fromIso ?? null,
        to: toIso ?? null,
        hits,
        returned: hits.length,
        estimatedTotalHits: Number.isFinite(body.estimatedTotalHits) ? body.estimatedTotalHits : null
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new CatalogError(`TGserver search timed out after ${timeoutMs}ms.`, 'TGSEARCH_UNAVAILABLE');
      if (error instanceof CatalogError) throw error;
      throw new CatalogError(`TGserver search unavailable: ${error?.message ?? String(error)}`, 'TGSEARCH_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }

  return Object.freeze({ endpoint, search });
}
