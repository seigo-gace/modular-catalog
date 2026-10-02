import assert from 'node:assert/strict';
import test from 'node:test';
import { createTgserverClient } from '../src/tgserver-client.js';
import { createDebugController, GRANITE_DEBUG_MODEL } from '../src/debug-controller.js';
import { executeDebugDecision, mapDebugDecisionToMcp } from '../src/debugai-mcp-client.js';

const root = process.cwd();

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('TGserver adapter sends only the supported search contract and normalizes observed logs', async () => {
  let captured = null;
  const client = createTgserverClient({
    baseUrl: 'http://127.0.0.1:3000',
    maxHits: 2,
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return jsonResponse({
        estimatedTotalHits: 4,
        hits: [
          { id: '1', project_id: 'P006', severity: 'error', message: 'first failure', timestamp: '2026-10-02T00:00:00Z', hash: 'h1' },
          { id: '2', project_id: 'OTHER', severity: 'error', message: 'wrong project', timestamp: '2026-10-02T00:01:00Z', hash: 'h2' },
          { id: '3', project_id: 'P006', severity: 'warn', message: 'second observation', timestamp: '2026-10-02T00:02:00Z', hash: 'h3' },
          { id: '4', project_id: 'P006', severity: 'error', message: 'third observation', timestamp: '2026-10-02T00:03:00Z', hash: 'h4' }
        ]
      });
    }
  });

  const result = await client.search({
    query: 'failure',
    project_id: 'P006',
    severity: 'error',
    from: '2026-10-01T00:00:00Z',
    to: '2026-10-03T00:00:00Z'
  });

  assert.equal(captured.url, 'http://127.0.0.1:3000/search');
  assert.deepEqual(captured.body, {
    query: 'failure',
    project_id: 'P006',
    severity: 'error',
    from: '2026-10-01T00:00:00Z',
    to: '2026-10-03T00:00:00Z'
  });
  assert.equal(result.returned, 2);
  assert.deepEqual(result.hits.map((hit) => hit.id), ['1', '3']);
  assert.equal(result.estimatedTotalHits, 4);

  await assert.rejects(
    () => client.search({ project_id: 'P006', severity: 'fatal' }),
    (error) => error?.code === 'TGS_INPUT_INVALID'
  );
});

test('normal Factory flow skips Granite when no explicit debug signal exists', async () => {
  const controller = await createDebugController({ rootDir: root, baseUrl: null, apiKey: null, fetchImpl: null });
  const decision = await controller.decide({
    repo: '/workspace/example',
    revision: 'a'.repeat(40),
    paths: ['src/index.js'],
    signals: [],
    logs: []
  });
  assert.equal(decision.action, 'SKIP');
  assert.equal(decision.decision_source, 'deterministic');
  assert.deepEqual(decision.reason_codes, ['NO_DEBUG_SIGNAL']);
});

test('Granite controller uses the real configured Granite backend model and stays inside supplied context', async () => {
  let capturedBody = null;
  const controller = await createDebugController({
    rootDir: root,
    baseUrl: 'http://127.0.0.1:8080',
    apiKey: 'test-only',
    fetchImpl: async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return jsonResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              schema_version: 'modulecatalog.debug-controller.v1',
              action: 'ANALYZE',
              reason_codes: ['RUNTIME_CONTRADICTION'],
              request: 'Investigate the repository/runtime contradiction using only supplied evidence.',
              repo: '/workspace/example',
              paths: ['src/index.js'],
              change_scope: [],
              task: null,
              evidence_refs: ['tg:h1']
            })
          },
          finish_reason: 'stop'
        }]
      });
    }
  });

  const decision = await controller.decide({
    repo: '/workspace/example',
    revision: 'b'.repeat(40),
    paths: ['src/index.js'],
    signals: [{
      type: 'REPOSITORY_RUNTIME_CONTRADICTION',
      summary: 'Repository says success while runtime records repeated failure.',
      evidence_refs: ['tg:h1']
    }],
    logs: [{ project_id: 'P006', severity: 'error', timestamp: '2026-10-02T00:00:00Z', message: 'failure', hash: 'h1' }],
    evidenceRefs: ['tg:h1']
  });

  assert.equal(capturedBody.model, GRANITE_DEBUG_MODEL);
  assert.equal(capturedBody.temperature, 0);
  assert.equal(capturedBody.stream, false);
  assert.deepEqual(capturedBody.response_format, { type: 'json_object' });
  assert.deepEqual(capturedBody.chat_template_kwargs, { enable_thinking: false });
  assert.equal(decision.action, 'ANALYZE');
  assert.equal(decision.decision_source, 'granite');
  assert.deepEqual(decision.paths, ['src/index.js']);
});

test('Granite controller rejects invented repository/path/evidence targets', async () => {
  const controller = await createDebugController({
    rootDir: root,
    baseUrl: 'http://127.0.0.1:8080',
    apiKey: 'test-only',
    fetchImpl: async () => jsonResponse({
      choices: [{ message: { content: JSON.stringify({
        schema_version: 'modulecatalog.debug-controller.v1',
        action: 'VERIFY',
        reason_codes: ['CHECK'],
        request: null,
        repo: '/workspace/example',
        paths: ['secrets/outside.js'],
        change_scope: [],
        task: 'verify',
        evidence_refs: []
      }) } }]
    })
  });

  await assert.rejects(
    () => controller.decide({
      repo: '/workspace/example',
      revision: 'c'.repeat(40),
      paths: ['src/index.js'],
      signals: [{ type: 'TEST_FAILURE', summary: 'test failed', evidence_refs: [] }]
    }),
    (error) => error?.code === 'DEBUG_CONTROLLER_CONTEXT_ESCAPE'
  );
});

test('DebugAI MCP adapter maps only ANALYZE/VERIFY and never creates an apply path', async () => {
  const analyze = {
    schema_version: 'modulecatalog.debug-controller.v1',
    action: 'ANALYZE',
    reason_codes: ['TEST_FAILURE'],
    request: 'Investigate the failed test.',
    repo: '/workspace/example',
    paths: [],
    change_scope: [],
    task: null,
    evidence_refs: [],
    decision_source: 'granite'
  };
  assert.deepEqual(mapDebugDecisionToMcp(analyze), {
    name: 'debugai_analyze',
    arguments: { request: 'Investigate the failed test.', repo: '/workspace/example' }
  });

  const verify = { ...analyze, action: 'VERIFY', request: null, paths: ['src/index.js'], task: 'run deterministic verification' };
  assert.deepEqual(mapDebugDecisionToMcp(verify), {
    name: 'debugai_verify',
    arguments: { repo: '/workspace/example', paths: ['src/index.js'], task: 'run deterministic verification' }
  });

  const result = await executeDebugDecision(analyze, async (request) => ({
    content: [{ type: 'text', text: JSON.stringify({
      schema: 'debugai.mcp-result/v1',
      tool: request.name,
      exit_code: 0,
      result: { status: 'ANALYZED' }
    }) }]
  }));
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.tool, 'debugai_analyze');
  assert.deepEqual(result.result, { status: 'ANALYZED' });

  const skipped = await executeDebugDecision({ ...analyze, action: 'SKIP', request: null });
  assert.equal(skipped.status, 'SKIPPED');
});
