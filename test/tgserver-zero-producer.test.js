import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TGSERVER_ZERO_PROJECT_ID,
  buildModuleCatalogZeroLog,
  buildTgServerBulkUrl,
  normalizeModuleCatalogCommand,
  normalizeModuleCatalogErrorCode,
  sendModuleCatalogRuntimeLog,
  validateTgServerBulkReceipt
} from '../src/tgserver-zero-producer.js';

test('P012 TGserver ZERO producer normalizes the canonical bulk ingest endpoint', () => {
  assert.equal(buildTgServerBulkUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000/ingest/bulk');
  assert.equal(buildTgServerBulkUrl('http://127.0.0.1:3000/ingest'), 'http://127.0.0.1:3000/ingest/bulk');
  assert.equal(buildTgServerBulkUrl('http://127.0.0.1:3000/ingest/bulk/'), 'http://127.0.0.1:3000/ingest/bulk');
});

test('P012 runtime envelope is fixed, bounded, and contains no arbitrary failure text', () => {
  assert.equal(TGSERVER_ZERO_PROJECT_ID, 'P012');
  assert.equal(normalizeModuleCatalogCommand('verify-index'), 'verify-index');
  assert.equal(normalizeModuleCatalogCommand('$(cat /secret)'), 'unknown');
  assert.equal(normalizeModuleCatalogErrorCode('INDEX_INVALID'), 'INDEX_INVALID');
  assert.equal(normalizeModuleCatalogErrorCode('secret=value'), 'UNKNOWN');

  const log = buildModuleCatalogZeroLog({
    status: 'failed',
    command: 'verify-index',
    durationMs: 123.8,
    errorCode: 'INDEX_INVALID',
    timestamp: '2026-10-04T12:00:00.000Z'
  });
  assert.deepEqual(log, {
    project_id: 'P012',
    severity: 'error',
    message: JSON.stringify({
      event: 'modulecatalog.cli.failed',
      command: 'verify-index',
      duration_ms: 123,
      error_code: 'INDEX_INVALID'
    }),
    hint: 'modulecatalog-runtime',
    timestamp: '2026-10-04T12:00:00.000Z'
  });
});

test('P012 sender uses logs[] without a per-producer secret and validates receipt', async () => {
  let captured = null;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ results: [{ status: 'accepted' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const result = await sendModuleCatalogRuntimeLog({
    status: 'completed',
    command: 'search',
    durationMs: 5,
    timestamp: '2026-10-04T12:00:01.000Z'
  }, {
    env: { TGSERVER_LOG_URL: 'http://127.0.0.1:3000/ingest', TGSERVER_LOG_TIMEOUT_MS: '50' },
    fetchImpl
  });

  assert.equal(result.status, 'SENT');
  assert.equal(captured.url, 'http://127.0.0.1:3000/ingest/bulk');
  assert.deepEqual(captured.options.headers, { 'content-type': 'application/json' });
  assert.equal('authorization' in captured.options.headers, false);
  const body = JSON.parse(captured.options.body);
  assert.equal(body.logs.length, 1);
  assert.equal(body.logs[0].project_id, 'P012');
  assert.equal(body.logs[0].severity, 'info');
});

test('P012 sender is fail-open when disabled, rejected, or unavailable', async () => {
  assert.deepEqual(await sendModuleCatalogRuntimeLog({ status: 'completed', command: 'search' }, { env: {}, fetchImpl: null }), { status: 'DISABLED' });

  const rejected = await sendModuleCatalogRuntimeLog({ status: 'completed', command: 'search' }, {
    env: { TGSERVER_LOG_URL: 'http://127.0.0.1:3000' },
    fetchImpl: async () => new Response(JSON.stringify({ results: [{ status: 'rejected' }] }), { status: 200 })
  });
  assert.deepEqual(rejected, { status: 'FAILED', reason: 'TRANSPORT_OR_RECEIPT' });

  const unavailable = await sendModuleCatalogRuntimeLog({ status: 'completed', command: 'search' }, {
    env: { TGSERVER_LOG_URL: 'http://127.0.0.1:3000' },
    fetchImpl: async () => { throw new Error('offline'); }
  });
  assert.deepEqual(unavailable, { status: 'FAILED', reason: 'TRANSPORT_OR_RECEIPT' });

  assert.doesNotThrow(() => validateTgServerBulkReceipt({ results: [{ status: 'duplicate' }] }, 1));
  assert.throws(() => validateTgServerBulkReceipt({ results: [] }, 1));
});
