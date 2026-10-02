import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectRepositoryChanges, mapChangedPathsToCatalogAssets } from '../src/repository-intake.js';

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

async function commit(repo, message) {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

async function removeRepository(repo) {
  await fs.rm(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

async function makeRepository() {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-intake-'));
  git(repo, ['init']);
  git(repo, ['config', 'user.name', 'ModuleCatalog Test']);
  git(repo, ['config', 'user.email', 'modulecatalog-test@example.invalid']);

  await write(path.join(repo, 'assets', 'alpha', 'source', 'index.js'), 'export function alpha() { return 1; }\n');
  await write(path.join(repo, 'assets', 'alpha', 'README.md'), '# Alpha\n');
  await write(path.join(repo, 'docs', 'notes.md'), '# Notes\n');
  const revisionA = await commit(repo, 'initial');

  await write(path.join(repo, 'assets', 'alpha', 'source', 'index.js'), 'export function alpha() { return 2; }\n');
  await write(path.join(repo, 'assets', 'beta', 'meta.json'), '{"id":"beta"}\n');
  await write(path.join(repo, 'docs', 'global.md'), '# Global\n');
  const revisionB = await commit(repo, 'incremental');

  await fs.mkdir(path.join(repo, 'assets', 'gamma'), { recursive: true });
  git(repo, ['mv', 'assets/beta/meta.json', 'assets/gamma/meta.json']);
  const revisionC = await commit(repo, 'rename asset path');

  return { repo, revisionA, revisionB, revisionC };
}

test('repository intake resolves exact revisions and projects only affected Catalog assets', async () => {
  const fixture = await makeRepository();
  try {
    const full = await inspectRepositoryChanges({
      repoPath: fixture.repo,
      currentRevision: fixture.revisionA
    });
    assert.equal(full.schema_version, 'modulecatalog.repository-intake.v1');
    assert.equal(full.mode, 'FULL_SNAPSHOT');
    assert.equal(full.previous_revision, null);
    assert.equal(full.current_revision, fixture.revisionA);
    assert.deepEqual(full.affected_asset_ids, ['alpha']);
    assert.equal(full.changes.some((entry) => entry.path === 'assets/alpha/source/index.js'), true);
    assert.equal(full.unmapped_paths.includes('docs/notes.md'), true);

    const incremental = await inspectRepositoryChanges({
      repoPath: fixture.repo,
      previousRevision: fixture.revisionA,
      currentRevision: fixture.revisionB
    });
    assert.equal(incremental.mode, 'INCREMENTAL');
    assert.deepEqual(incremental.affected_asset_ids, ['alpha', 'beta']);
    assert.equal(incremental.changes.some((entry) => entry.status === 'MODIFIED' && entry.path === 'assets/alpha/source/index.js'), true);
    assert.equal(incremental.changes.some((entry) => entry.status === 'ADDED' && entry.path === 'assets/beta/meta.json'), true);
    assert.equal(incremental.unmapped_paths.includes('docs/global.md'), true);

    const renamed = await inspectRepositoryChanges({
      repoPath: fixture.repo,
      previousRevision: fixture.revisionB,
      currentRevision: fixture.revisionC
    });
    assert.equal(renamed.mode, 'INCREMENTAL');
    assert.deepEqual(renamed.affected_asset_ids, ['beta', 'gamma']);
    const rename = renamed.changes.find((entry) => entry.status === 'RENAMED');
    assert.equal(rename?.old_path, 'assets/beta/meta.json');
    assert.equal(rename?.path, 'assets/gamma/meta.json');

    const unchanged = await inspectRepositoryChanges({
      repoPath: fixture.repo,
      previousRevision: fixture.revisionC,
      currentRevision: fixture.revisionC
    });
    assert.equal(unchanged.mode, 'UNCHANGED');
    assert.deepEqual(unchanged.changes, []);
    assert.deepEqual(unchanged.affected_asset_ids, []);
    assert.deepEqual(unchanged.unmapped_paths, []);
  } finally {
    await removeRepository(fixture.repo);
  }
});

test('repository intake rejects mutable or unresolved revision identity', async () => {
  const fixture = await makeRepository();
  try {
    await assert.rejects(
      () => inspectRepositoryChanges({ repoPath: fixture.repo, currentRevision: 'HEAD' }),
      (error) => error?.code === 'REPOSITORY_INTAKE_INVALID'
    );
    await assert.rejects(
      () => inspectRepositoryChanges({ repoPath: fixture.repo, currentRevision: 'f'.repeat(40) }),
      (error) => error?.code === 'REPOSITORY_REVISION_UNRESOLVED'
    );
  } finally {
    await removeRepository(fixture.repo);
  }
});

test('changed-path projection preserves rename source and destination asset identities', () => {
  const projected = mapChangedPathsToCatalogAssets([
    { status: 'RENAMED', old_path: 'assets/old/source.js', path: 'assets/new/source.js' },
    { status: 'MODIFIED', path: 'docs/architecture.md' }
  ]);
  assert.deepEqual(projected.affected_asset_ids, ['new', 'old']);
  assert.deepEqual(projected.unmapped_paths, ['docs/architecture.md']);
});
