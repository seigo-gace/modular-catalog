import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { deriveRuntimeSignals, runFactoryInspection } from '../src/factory-orchestrator.js';

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

const TEST_REPO = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-orchestrator-'));
git(TEST_REPO, ['init']);
git(TEST_REPO, ['config', 'user.name', 'ModuleCatalog Test']);
git(TEST_REPO, ['config', 'user.email', 'modulecatalog-test@example.invalid']);
await fs.mkdir(path.join(TEST_REPO, 'src'), { recursive: true });
await fs.writeFile(path.join(TEST_REPO, 'src', 'index.js'), 'export const ready = true;\n', 'utf8');
git(TEST_REPO, ['add', '-A']);
git(TEST_REPO, ['commit', '-m', 'fixture']);
const REVISION = git(TEST_REPO, ['rev-parse', 'HEAD']);

after(async () => {
  await fs.rm(TEST_REPO, { recursive: true, force: true });
});

test('Factory inspection resolves the exact repository revision and stays mutation-free when optional services are absent', async () => {
  const result = await runFactoryInspection({
    repo: TEST_REPO,
    revision: REVISION,
    paths: ['src/index.js']
  });
  assert.equal(result.schema_version, 'modulecatalog.factory-inspection.v1');
  assert.equal(result.status, 'INSPECTION_COMPLETE');
  assert.equal(result.repo, TEST_REPO);
  assert.equal(result.revision, REVISION);
  assert.equal(result.repository_intake.mode, 'FULL_SNAPSHOT');
  assert.equal(result.repository_intake.current_revision, REVISION);
  assert.equal(result.tgserver.status, 'SKIPPED');
  assert.equal(result.debug.status, 'SKIPPED');
  assert.equal(result.qce.status, 'SKIPPED');
  assert.equal(result.astera_evidence_search.code, 'ASTERA_EVIDENCE_CONTRACT_NOT_AVAILABLE');
  assert.deepEqual(result.mutation, { source_repository: false, kb_runtime: false });
});

test('repeated scoped TGserver ZERO artifact failures create an explicit debug signal and route through controller then DebugAI', async () => {
  const calls = [];
  const debugController = {
    async decide(input) {
      calls.push(['controller', input]);
      assert.equal(input.repo, TEST_REPO);
      assert.equal(input.revision, REVISION);
      assert.equal(input.signals.some((signal) => signal.type === 'REPEATED_ERROR_LOG'), true);
      assert.deepEqual(input.evidenceRefs, ['tg:same-hash']);
      return {
        schema_version: 'modulecatalog.debug-controller.v1',
        action: 'ANALYZE',
        reason_codes: ['REPEATED_ERROR_LOG'],
        request: 'Analyze the repeated runtime failure from supplied evidence.',
        repo: TEST_REPO,
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
    repo: TEST_REPO,
    revision: REVISION,
    paths: ['src/index.js'],
    tgserver_zero: {
      expected_repo: 'owner/source',
      expected_stream: 'runtime',
      meta: {
        generation: 'TGserver ZERO',
        repo: 'owner/source',
        stream: 'runtime',
        project_id: 'P006',
        purpose: 'Factory runtime evidence'
      },
      result: {
        estimatedTotalHits: 2,
        hits: [
          { id: '1', project_id: 'P006', severity: 'error', timestamp: '2026-10-02T00:00:00Z', message: 'same failure', hash: 'same-hash' },
          { id: '2', project_id: 'P006', severity: 'error', timestamp: '2026-10-02T00:01:00Z', message: 'same failure', hash: 'same-hash' }
        ]
      }
    },
    qce_request: qceRequest
  }, { debugController, debugAi, qce });

  assert.equal(result.project_id, 'P006');
  assert.equal(result.tgserver.status, 'OBSERVED');
  assert.equal(result.tgserver.source, 'TGSERVER_ZERO_CENTRAL_READER_ARTIFACT');
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].type, 'REPEATED_ERROR_LOG');
  assert.equal(result.debug.status, 'COMPLETED');
  assert.equal(result.debug.execution.tool, 'debugai_analyze');
  assert.equal(result.qce.status, 'EVALUATED');
  assert.equal(result.qce.result.status, 'REVISION_REQUIRED');
  assert.deepEqual(calls.map(([name]) => name), ['controller', 'debugai', 'qce']);
});

test('Factory rejects direct Project-to-TGserver adapters', async () => {
  await assert.rejects(
    () => runFactoryInspection({ repo: TEST_REPO, revision: REVISION }, { tgserver: { async search() { return { hits: [] }; } } }),
    (error) => error?.code === 'TGS_DIRECT_ACCESS_DISABLED'
  );
});

test('Factory does not silently ignore actionable signals when the Debug Controller is unavailable', async () => {
  await assert.rejects(
    () => runFactoryInspection({
      repo: TEST_REPO,
      revision: REVISION,
      signals: [{ type: 'TEST_FAILURE', summary: 'fixture failed', evidence_refs: [] }]
    }),
    (error) => error?.code === 'DEBUG_CONTROLLER_NOT_CONFIGURED'
  );
});

test('Factory rejects an unresolved exact revision before optional runtime evidence is processed', async () => {
  await assert.rejects(
    () => runFactoryInspection({
      repo: TEST_REPO,
      revision: 'f'.repeat(40),
      tgserver_zero: {
        expected_repo: 'owner/source',
        expected_stream: 'runtime',
        meta: { generation: 'invalid', repo: 'owner/source', stream: 'runtime', project_id: 'P006' },
        result: { hits: [] }
      }
    }),
    (error) => error?.code === 'REPOSITORY_REVISION_UNRESOLVED'
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
