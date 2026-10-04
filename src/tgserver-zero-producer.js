const PROJECT_ID = 'P012';
const HINT = 'modulecatalog-runtime';
const DEFAULT_TIMEOUT_MS = 1500;
const MAX_TIMEOUT_MS = 10000;
const KNOWN_COMMANDS = new Set([
  'search',
  'show',
  'validate',
  'register',
  'build-index',
  'verify-index',
  'repository-candidate',
  'export-reusable-assets',
  'prepare-kb-outbox',
  'preflight-kb-delivery',
  'publish-kb-delivery',
  'verify-kb-active'
]);

export function buildTgServerBulkUrl(value) {
  const base = String(value ?? '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('TGSERVER_LOG_URL is empty');
  if (base.endsWith('/ingest/bulk')) return base;
  if (base.endsWith('/ingest')) return `${base}/bulk`;
  return `${base}/ingest/bulk`;
}

export function normalizeModuleCatalogCommand(value) {
  const command = String(value ?? '').trim();
  return KNOWN_COMMANDS.has(command) ? command : 'unknown';
}

export function normalizeModuleCatalogErrorCode(value) {
  const code = String(value ?? '').trim();
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'UNKNOWN';
}

export function buildModuleCatalogZeroLog({ status, command, durationMs, errorCode = null, timestamp = new Date().toISOString() } = {}) {
  const normalizedStatus = status === 'failed' ? 'failed' : 'completed';
  const normalizedCommand = normalizeModuleCatalogCommand(command);
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, Math.min(Math.trunc(durationMs), 86_400_000)) : 0;
  const safeErrorCode = normalizedStatus === 'failed' ? normalizeModuleCatalogErrorCode(errorCode) : null;
  const message = JSON.stringify({
    event: normalizedStatus === 'failed' ? 'modulecatalog.cli.failed' : 'modulecatalog.cli.completed',
    command: normalizedCommand,
    duration_ms: safeDuration,
    error_code: safeErrorCode
  });
  return Object.freeze({
    project_id: PROJECT_ID,
    severity: normalizedStatus === 'failed' ? 'error' : 'info',
    message,
    hint: HINT,
    timestamp: String(timestamp)
  });
}

export function validateTgServerBulkReceipt(payload, expectedCount) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.results)) {
    throw new Error('TGserver ZERO bulk receipt is invalid');
  }
  if (payload.results.length !== expectedCount) {
    throw new Error(`TGserver ZERO bulk receipt count mismatch: expected ${expectedCount}, got ${payload.results.length}`);
  }
  if (payload.results.some((item) => item?.status !== 'accepted' && item?.status !== 'duplicate')) {
    throw new Error('TGserver ZERO bulk receipt contains a non-success status');
  }
}

function resolveTimeoutMs(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(parsed, MAX_TIMEOUT_MS);
}

export async function sendModuleCatalogRuntimeLog(input, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const configuredUrl = String(env.TGSERVER_LOG_URL ?? '').trim();
  if (!configuredUrl || typeof fetchImpl !== 'function') return Object.freeze({ status: 'DISABLED' });

  const log = buildModuleCatalogZeroLog(input);
  const timeoutMs = resolveTimeoutMs(env.TGSERVER_LOG_TIMEOUT_MS);
  try {
    const response = await fetchImpl(buildTgServerBulkUrl(configuredUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ logs: [log] }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response?.ok) return Object.freeze({ status: 'FAILED', reason: 'HTTP_STATUS' });
    validateTgServerBulkReceipt(await response.json(), 1);
    return Object.freeze({ status: 'SENT' });
  } catch {
    return Object.freeze({ status: 'FAILED', reason: 'TRANSPORT_OR_RECEIPT' });
  }
}

export const TGSERVER_ZERO_PROJECT_ID = PROJECT_ID;
