import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateAssetDirectory } from '../src/catalog.js';
import { assessRepositoryAssetCandidate, materializeRepositoryAssetCandidate } from '../src/repository-asset-candidate.js';

const catalogRoot = process.cwd();

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

async function makeRepository() {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-candidate-repo-'));
  git(repo, ['init']);
  git(repo, ['config', 'user.name', 'ModuleCatalog Test']);
  git(repo, ['config', 'user.email', 'modulecatalog-test@example.invalid']);

  await write(path.join(repo, 'module', 'docs', 'design-note.md'), '# Design\nExact design from repository.\n');
  await write(path.join(repo, 'module', 'docs', 'logic-note.md'), '# Logic\nExact logic from repository.\n');
  await write(path.join(repo, 'module', 'docs', 'architecture-note.md'), '# Architecture\nExact architecture from repository.\n');
  await write(path.join(repo, 'module', 'src', 'index.js'), 'export function run(value) { return value + 1; }\n');
  await write(path.join(repo, 'module', 'checks', 'normal.test.cjs'), "const assert = require('node:assert/strict'); assert.equal(1 + 1, 2);\n");
  await write(path.join(repo, 'module', 'checks', 'user.test.cjs'), "const assert = require('node:assert/strict'); assert.equal('ok'.toUpperCase(), 'OK');\n");
  await write(path.join(repo, 'module', 'verification', 'evidence.json'), JSON.stringify({
    normal: { passed: true, commands: ['node --test checks/normal.test.cjs'], expectedResults: ['normal behavior passes'] },
    user: { passed: true, commands: ['node --test checks/user.test.cjs'], expectedResults: ['user behavior passes'] }
  }, null, 2) + '\n');

  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'candidate fixture']);
  const revision = git(repo, ['rev-parse', 'HEAD']);
  return { repo, revision };
}

function specFor(revision, overrides = {}) {
  const spec = {
    schema_version: 'modulecatalog.repository-asset-candidate-spec.v1',
    declaration: {
      schemaVersion: 1,
      id: 'external-example-module',
      name: 'External Example Module',
      version: '1.0.0',
      summary: 'Explicit reusable module declaration.',
      purpose: 'Verify exact-revision candidate construction.',
      responsibility: 'Expose one verified example operation.',
      layers: ['Feature'],
      languages: ['JavaScript'],
      runtimes: ['Node.js 22'],
      tags: ['example'],
      dependencies: [],
      constraints: ['no direct mutation authority'],
      source: { repository: 'example/external-repository', commit: revision },
      verifiedAt: '2026-10-02T00:00:00.000Z'
    },
    files: {
      design: 'docs/design-note.md',
      logic: 'docs/logic-note.md',
      architecture: 'docs/architecture-note.md',
      evidence: 'verification/evidence.json',
      source: ['src/index.js'],
      normal_tests: ['checks/normal.test.cjs'],
      user_tests: ['checks/user.test.cjs']
    }
  };
  return {
    ...spec,
    ...overrides,
    declaration: { ...spec.declaration, ...(overrides.declaration ?? {}) },
    files: { ...spec.files, ...(overrides.files ?? {}) }
  };
}

test('constructs a validated non-registered candidate from exact committed repository facts', async () => {
  const fixture = await makeRepository();
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-candidate-output-'));
  const output = path.join(outputRoot, 'candidate');
  try {
    const spec = specFor(fixture.revision);
    const assessment = await assessRepositoryAssetCandidate({
      repoPath: fixture.repo,
      revision: fixture.revision,
      assetRoot: 'module',
      spec
    });
    assert.equal(assessment.status, 'READY_TO_MATERIALIZE');
    assert.equal(assessment.asset_id, 'external-example-module');
    assert.equal(assessment.revision, fixture.revision);
    assert.deepEqual(assessment.missing_requirements, []);
    assert.equal(assessment.admission.catalog_registered, false);
    assert.equal(assessment.admission.manifest_created, false);

    await write(path.join(fixture.repo, 'module', 'src', 'index.js'), 'export function run(value) { return 999; }\n');

    const materialized = await materializeRepositoryAssetCandidate(catalogRoot, {
      repoPath: fixture.repo,
      revision: fixture.revision,
      assetRoot: 'module',
      spec
    }, output);
    assert.equal(materialized.status, 'READY_FOR_ADMISSION');
    assert.equal(materialized.admission.validation_complete, true);
    assert.equal(materialized.admission.catalog_registered, false);
    assert.equal(materialized.admission.manifest_created, false);

    const validated = await validateAssetDirectory(output);
    assert.equal(validated.meta.id, 'external-example-module');
    assert.equal(validated.meta.source.commit, fixture.revision);
    assert.equal(validated.evidence.normal.passed, true);
    assert.equal(validated.evidence.user.passed, true);
    assert.equal(await fs.readFile(path.join(output, 'source', 'src', 'index.js'), 'utf8'), 'export function run(value) { return value + 1; }\n');
    assert.equal(await fs.stat(path.join(output, 'manifest.json')).then(() => true).catch(() => false), false);
  } finally {
    await fs.rm(fixture.repo, { recursive: true, force: true });
    await fs.rm(outputRoot, { recursive: true, force: true });
  }
});

test('keeps missing repository evidence explicit and refuses materialization', async () => {
  const fixture = await makeRepository();
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-candidate-missing-'));
  try {
    const spec = specFor(fixture.revision, { files: { user_tests: ['checks/not-recorded.test.cjs'] } });
    const assessment = await assessRepositoryAssetCandidate({
      repoPath: fixture.repo,
      revision: fixture.revision,
      assetRoot: 'module',
      spec
    });
    assert.equal(assessment.status, 'INCOMPLETE');
    assert.deepEqual(assessment.missing_requirements, [{
      role: 'user_test',
      source_path: 'module/checks/not-recorded.test.cjs',
      required: true
    }]);
    await assert.rejects(
      () => materializeRepositoryAssetCandidate(catalogRoot, {
        repoPath: fixture.repo,
        revision: fixture.revision,
        assetRoot: 'module',
        spec
      }, path.join(outputRoot, 'candidate')),
      (error) => error?.code === 'ASSET_CANDIDATE_INCOMPLETE' && error?.details?.status === 'INCOMPLETE'
    );
  } finally {
    await fs.rm(fixture.repo, { recursive: true, force: true });
    await fs.rm(outputRoot, { recursive: true, force: true });
  }
});

test('rejects declaration provenance that does not match the inspected exact revision', async () => {
  const fixture = await makeRepository();
  try {
    const wrong = (fixture.revision[0] === 'f' ? 'e' : 'f') + fixture.revision.slice(1);
    await assert.rejects(
      () => assessRepositoryAssetCandidate({
        repoPath: fixture.repo,
        revision: fixture.revision,
        assetRoot: 'module',
        spec: specFor(fixture.revision, { declaration: { source: { repository: 'example/external-repository', commit: wrong } } })
      }),
      (error) => error?.code === 'ASSET_CANDIDATE_REVISION_MISMATCH'
    );
  } finally {
    await fs.rm(fixture.repo, { recursive: true, force: true });
  }
});

test('refuses to materialize generated candidates inside the ModuleCatalog working tree', async () => {
  const fixture = await makeRepository();
  try {
    await assert.rejects(
      () => materializeRepositoryAssetCandidate(catalogRoot, {
        repoPath: fixture.repo,
        revision: fixture.revision,
        assetRoot: 'module',
        spec: specFor(fixture.revision)
      }, path.join(catalogRoot, '.candidate-should-not-exist')),
      (error) => error?.code === 'ASSET_CANDIDATE_OUTPUT_UNSAFE'
    );
  } finally {
    await fs.rm(fixture.repo, { recursive: true, force: true });
    await fs.rm(path.join(catalogRoot, '.candidate-should-not-exist'), { recursive: true, force: true });
  }
});
