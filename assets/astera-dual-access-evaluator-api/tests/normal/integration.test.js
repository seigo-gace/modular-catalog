'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('元Repositoryの独立判定API Integration Testが全件合格する', () => {
  const sourceRoot = process.env.ASTERA_SOURCE_ROOT || '/workspace/scratch/99a09a0b80a1/astera_v8';
  const testFile = path.join(sourceRoot, 'src/quality-completion-evaluator/api/server.test.js');
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', testFile], { cwd: sourceRoot, encoding: 'utf8', env });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /tests 4/);
  assert.match(output, /pass 4/);
  assert.match(output, /fail 0/);
});
