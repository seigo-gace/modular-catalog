import { CatalogError } from './catalog.js';

const QCE_REQUEST_SCHEMA = 'astera.quality-completion.request.v1';
const QCE_RESULT_SCHEMA = 'astera.quality-completion.result.v1';
const QCE_STATUSES = new Set(['PASSED', 'REVISION_REQUIRED', 'BLOCKED', 'EVALUATION_FAILED', 'INVALID_INPUT']);

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assertRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new CatalogError('Astera QCE request must be an object.', 'QCE_INPUT_INVALID');
  }
  if (request.schema_version !== QCE_REQUEST_SCHEMA) {
    throw new CatalogError(`Astera QCE request schema must be ${QCE_REQUEST_SCHEMA}.`, 'QCE_INPUT_INVALID');
  }
  if (!String(request.evaluation_id ?? '').trim() || !String(request.project_id ?? '').trim()) {
    throw new CatalogError('Astera QCE evaluation_id and project_id are required.', 'QCE_INPUT_INVALID');
  }
  if (!request.target || typeof request.target !== 'object' || Array.isArray(request.target)) {
    throw new CatalogError('Astera QCE target is required.', 'QCE_INPUT_INVALID');
  }
  if (!Array.isArray(request.requirements) || request.requirements.length === 0) {
    throw new CatalogError('Astera QCE requirements must be a non-empty array.', 'QCE_INPUT_INVALID');
  }
  if (!request.evaluation_config || typeof request.evaluation_config !== 'object' || Array.isArray(request.evaluation_config)) {
    throw new CatalogError('Astera QCE evaluation_config is required.', 'QCE_INPUT_INVALID');
  }
}

function assertResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new CatalogError('Astera QCE returned a non-object result.', 'QCE_INVALID_RESPONSE');
  }
  if (result.schema_version !== QCE_RESULT_SCHEMA || !QCE_STATUSES.has(result.status) || typeof result.evaluation_complete !== 'boolean' || !result.judgment || typeof result.judgment !== 'object' || Array.isArray(result.judgment)) {
    throw new CatalogError('Astera QCE response contract mismatch.', 'QCE_INVALID_RESPONSE');
  }
  return result;
}

export function createAsteraQceClient({
  baseUrl = process.env.ASTERA_QCE_URL || 'http://127.0.0.1:7374',
  apiKey = process.env.ASTERA_API_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = positiveInteger(process.env.MODULECATALOG_QCE_TIMEOUT_MS, 60000)
} = {}) {
  if (!baseUrl) throw new CatalogError('ASTERA_QCE_URL is required.', 'QCE_NOT_CONFIGURED');
  if (!apiKey) throw new CatalogError('ASTERA_API_KEY is required for Astera QCE.', 'QCE_NOT_CONFIGURED');
  if (typeof fetchImpl !== 'function') throw new CatalogError('Astera QCE client requires fetch.', 'QCE_NOT_CONFIGURED');
  const endpoint = new URL('/v1/evaluate', baseUrl).toString();

  async function evaluate(request) {
    assertRequest(request);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new CatalogError('Astera QCE returned invalid JSON.', 'QCE_INVALID_RESPONSE');
      }
      if (!response.ok) {
        const detail = typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`;
        const error = new CatalogError(`Astera QCE request failed: ${detail}`, 'QCE_REQUEST_FAILED');
        error.status = response.status;
        error.details = body;
        throw error;
      }
      return Object.freeze(assertResult(body));
    } catch (error) {
      if (error?.name === 'AbortError') throw new CatalogError(`Astera QCE timed out after ${timeoutMs}ms.`, 'QCE_UNAVAILABLE');
      if (error instanceof CatalogError) throw error;
      throw new CatalogError(`Astera QCE unavailable: ${error?.message ?? String(error)}`, 'QCE_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }

  return Object.freeze({ endpoint, evaluate });
}

export function asteraEvidenceSearchBoundary() {
  return Object.freeze({
    status: 'NOT_AUTHORIZED',
    code: 'ASTERA_EVIDENCE_CONTRACT_NOT_AVAILABLE',
    reason: 'The current direct Evidence Search route is an Astera-internal endpoint authenticated as service=astera-main; ModuleCatalog has no distinct sanctioned caller identity in that contract.'
  });
}
