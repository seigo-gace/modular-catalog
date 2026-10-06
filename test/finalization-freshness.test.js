import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { assertCurrentFinalizationCommit, fetchCurrentFinalizationHead, RUNTIME_ADMISSION_CONTROL } from '../src/runtime-admission-queue.js';

const root = process.cwd();
const current = 'a'.repeat(40);
const stale = 'b'.repeat(40);

function responseJson(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('runtime finalization authority resolves the fixed current Catalog branch HEAD', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return responseJson({ object: { sha: current } });
  };
  assert.equal(await fetchCurrentFinalizationHead(fetchImpl), current);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].includes(`/git/ref/heads/${RUNTIME_ADMISSION_CONTROL.finalization_branch}`), true);
});

test('runtime admission rejects an approved snapshot after the Catalog finalization branch advances', async () => {
  const fetchImpl = async () => responseJson({ object: { sha: current } });
  assert.equal(await assertCurrentFinalizationCommit(current, fetchImpl), current);
  await assert.rejects(
    () => assertCurrentFinalizationCommit(stale, fetchImpl),
    (error) => error?.code === 'CATALOG_FINALIZATION_STALE_COMMIT' && error?.details?.current_head === current && error?.details?.approved_commit === stale
  );
});

test('Factory and GPT admission workflows fail closed unless data commit equals current finalization HEAD', async () => {
  const factory = await fs.readFile(path.join(root, '.github', 'workflows', 'chat-factory-process.yml'), 'utf8');
  const admission = await fs.readFile(path.join(root, '.github', 'workflows', 'chat-kb-admission.yml'), 'utf8');
  for (const workflow of [factory, admission]) {
    assert.match(workflow, /git ls-remote --exit-code origin refs\/heads\/feat\/reusable-knowledge-factory-v1-20261002/);
    assert.match(workflow, /\[\[ "\$current" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
    assert.doesNotMatch(workflow, /test "\$current" =~/);
  }
  assert.match(factory, /CHAT_FACTORY_STALE_COMMIT/);
  assert.match(factory, /steps\.request\.outputs\.catalog_commit/);
  assert.match(admission, /CHAT_KB_ADMISSION_STALE_COMMIT/);
  assert.match(admission, /steps\.review\.outputs\.catalog_commit/);
});

test('runtime worker checks freshness before accepting an already-sealed outbox', async () => {
  const source = await fs.readFile(path.join(root, 'src', 'runtime-admission-queue.js'), 'utf8');
  const freshness = source.indexOf('await assertCurrentFinalizationCommit(ticket.catalog_commit, fetchImpl)');
  const outbox = source.indexOf('const existing = await manifestState(ticket)');
  assert.notEqual(freshness, -1);
  assert.notEqual(outbox, -1);
  assert.equal(freshness < outbox, true);
});

test('Master-PC pull checks Contabo current source branch and HEAD before reading or transferring outbox data', async () => {
  const script = await fs.readFile(path.join(root, 'scripts', 'pull-modulecatalog-kb-delivery-windows.ps1'), 'utf8');
  assert.match(script, /\$FinalizationBranch = 'feat\/reusable-knowledge-factory-v1-20261002'/);
  assert.match(script, /\$RemoteCatalogRepo = '\/home\/admin1\/projects\/Catalog\/modular-catalog'/);
  assert.doesNotMatch(script, /\$RemoteCatalogRepo = '\/home\/admin1\/projects\/modular-catalog'/);
  assert.match(script, /git -C \$RemoteCatalogRepo rev-parse HEAD/);
  assert.match(script, /git -C \$RemoteCatalogRepo branch --show-current/);
  assert.match(script, /MODULECATALOG_REMOTE_SOURCE_BRANCH_MISMATCH/);
  assert.match(script, /MODULECATALOG_STALE_FINAL_DELIVERY/);
  const freshness = script.indexOf('$remoteSourceHeadOutput');
  const manifest = script.indexOf('$remoteHashOutput');
  const scp = script.indexOf('& $ScpExe');
  assert.equal(freshness >= 0 && freshness < manifest && manifest < scp, true);
});
