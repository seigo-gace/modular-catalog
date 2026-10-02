import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveRuntimeSignals, runFactoryInspection } from '../src/factory-orchestrator.js';

const REVISION = 'd'.repeat(40);

test('Factory inspection stays deterministic and mutation-free when optional services are absent', async () => {
  const result = await runFactoryInspection({
    repo: '/workspace/example',
    revision: REVISION,
    paths: ['src/index.js']
  });
  assert.equal(result.schema_version, 'modulecatalog.factory-inspection.v1');
  assert.equal(result.status, 'INSPECTION_COMPLETE');
  assert.equal(result.tgserver.status, 'SKIPPED');
  assert.equal(result.debug.status, 'SKIPPED');
  assert.equal(result.qce.status, 'SKIPPED');
  assert.equal(result.astera_evidence_search.code, 'ASTERA_EVIDENCE_CONTRACT_NOT_AVAILABLE');
  assert.deepEqual(result.mutation, { source_repository: false, kb_runtime: false });
});

test('repeated scoped TGserver failures create an explicit debug signal and route through controller then DebugAI', async () => {
  const calls = [];
  const tgserver = {
    async search(request) {
      calls.push(['tgserver', request]);
      return {
        project_id: 'P006',
        query: 'asset failure',
        severity: 'error',
        from: null,
        to: null,
        returned: 2,
        estimatedTotalHits: 2,
        hits: [
          { id: '1', project_id: 'P006', severity: 'error', timestamp: '2026-10-02T00:00:00Z', message: 'same failure', hash: 'same-hash' },
          { id: '2', project_id: 'P006', severity: 'error', timestamp: '2026-10-02T00:01:00Z', message: 'same failure', hash: 'same-hash' }
        ]
      };
    }
  };
  const debugController = {
    async decide(input) {
      calls.push(['controller', input]);
      assert.equal(input.signals.some((signal) => signal.type === 'REPEATED_ERROR_LOG'), true);
      assert.deepEqual(input.evidenceRefs, ['tg:same-hash']);
      return {
        schema_version: 'modulecatalog.debug-controller.v1',
        action: 'ANALYZE',
        reason_codes: ['REPEATED_ERROR_LOG'],
        request: 'Analyze the repeated runtime failure from supplied evidence.',
        repo: '/workspace/example',
        paths: ['src/index.js'],
        change_scope: [],
        task: null,
        evidence_refs: ['tg:same-hash'],
        decision_source: 'fixture'
      };
    }
  };
  const debugAi = {
    async execute(decision) {
      calls.push(['debugai', decision]);
      return { status: 'COMPLETED', tool: 'debugai_analyze', result: { status: 'ANALYZED' }, exit_code: 0 };
    }
  };
  const qce = {
    async evaluate(request) {
      calls.push(['qce', request]);
      return {
        schema_version: 'astera.quality-completion.result.v1',
        status: 'REVISION_REQUIRED',
        evaluation_complete: true,
        judgment: { passed: false }
      };
    }
  };
  const qceRequest = {
    schema_version: 'astera.quality-completion.request.v1',
    evaluation_id: 'evaluation-1',
    project_id: 'ModuleCatalog',
    target: {},
    requirements: [{}],
    evaluation_config: {}
  };

  const result = await runFactoryInspection({
    repo: '/workspace/example',
    revision: REVISION,
    paths: ['src/index.js'],
    project_id: 'P006',
    tg_query: 'asset failure',
    tg_severity: 'error',
    qce_request: qceRequest
  }, { tgserver, debugController, debugAi, qce });

  assert.equal(result.tgserver.status, 'OBSERVED');
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].type, 'REPEATED_ERROR_LOG');
  assert.equal(result.debug.status, 'COMPLETED');
  assert.equal(result.debug.execution.tool, 'debugai_analyze');
  assert.equal(result.qce.status, 'EVALUATED');
  assert.equal(result.qce.result.status, 'REVISION_REQUIRED');
  assert.deepEqual(calls.map(([name]) => name), ['tgserver', 'controller', 'debugai', 'qce']);
});

test('Factory does not silently ignore actionable signals when the Debug Controller is unavailable', async () => {
  await assert.rejects(
    () => runFactoryInspection({
      repo: '/workspace/example',
      revision: REVISION,
      signals: [{ type: 'TEST_FAILURE', summary: 'fixture failed', evidence_refs: [] }]
    }),
    (error) => error?.code === 'DEBUG_CONTROLLER_NOT_CONFIGURED'
  );
});

test('runtime signal derivation requires repetition and never promotes a single warning', () => {
  assert.deepEqual(deriveRuntimeSignals([
    { severity: 'warn', timestamp: '2026-10-02T00:00:00Z', message: 'one warning', hash: 'one' }
  ]), []);
  const repeated = deriveRuntimeSignals([
    { severity: 'warn', timestamp: '2026-10-02T00:00:00Z', message: 'repeat', hash: 'h' },
    { severity: 'warn', timestamp: '2026-10-02T00:01:00Z', message: 'repeat', hash: 'h' }
  ]);
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].occurrence_count, 2);
  assert.deepEqual(repeated[0].evidence_refs, ['tg:h']);
});
