'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('一般TenantとSkill専用の判定API利用を実Systemで完了する', () => {
  const sourceRoot = process.env.ASTERA_SOURCE_ROOT || '/workspace/scratch/99a09a0b80a1/astera_v8';
  const testFile = path.join(sourceRoot, 'src/quality-completion-evaluator/api/server.test.js');
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', testFile], { cwd: sourceRoot, encoding: 'utf8', env });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /public API accepts Astera tenant key and meters usage/);
  assert.match(output, /Skill API is private, unlimited, and never publishes/);
  assert.match(output, /rejects oversized payloads/);
});
