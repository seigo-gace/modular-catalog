import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const cli = path.resolve('src/cli.js');
const fixture = path.resolve('test/fixtures/valid-asset');

async function run(root, args) {
  return exec(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
}

test('user can register, search, inspect only needed data, and verify the catalog', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'modular-catalog-user-'));
  try {
    await fs.mkdir(path.join(root, 'catalog'), { recursive: true });
    await fs.writeFile(path.join(root, 'catalog/index.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date(0).toISOString(), assetCount: 0, entries: [] }));

    const registered = JSON.parse((await run(root, ['register', fixture, '--json'])).stdout);
    assert.equal(registered.id, 'verified-http-retry');

    const results = JSON.parse((await run(root, ['search', '--query', 'node webhook retry', '--language', 'JavaScript', '--limit', '3', '--json'])).stdout);
    assert.equal(results[0].id, 'verified-http-retry');
    assert.match(results[0].assetHash, /^[a-f0-9]{64}$/);

    const metaOnly = JSON.parse((await run(root, ['show', 'verified-http-retry', '--section', 'meta', '--json'])).stdout);
    assert.deepEqual(Object.keys(metaOnly), ['meta.json']);
    assert.equal(Object.keys(metaOnly).some((key) => key.startsWith('code/')), false);

    const verified = JSON.parse((await run(root, ['verify-index', '--json'])).stdout);
    assert.deepEqual(verified, { valid: true, assetCount: 1 });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('user receives a concise failure when an unverified asset is registered', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'modular-catalog-user-fail-'));
  const candidate = path.join(root, 'candidate');
  try {
    await fs.mkdir(path.join(root, 'catalog'), { recursive: true });
    await fs.writeFile(path.join(root, 'catalog/index.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date(0).toISOString(), assetCount: 0, entries: [] }));
    await fs.cp(fixture, candidate, { recursive: true });
    const evidencePath = path.join(candidate, 'evidence.json');
    const evidence = JSON.parse(await fs.readFile(evidencePath, 'utf8'));
    evidence.normal.passed = false;
    await fs.writeFile(evidencePath, JSON.stringify(evidence));

    await assert.rejects(
      () => run(root, ['register', candidate, '--json']),
      (error) => {
        const failure = JSON.parse(error.stderr.trim());
        assert.equal(failure.code, 'UNVERIFIED_ASSET');
        return true;
      }
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
