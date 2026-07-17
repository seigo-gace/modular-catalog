import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { selectControlSections, verifyControl } from '../src/control.js';

const root = path.resolve('.');

test('selects only always rules and task-specific sections', async () => {
  const selected = await selectControlSections(root, ['github']);
  assert.deepEqual(selected, [
    'control/sections/01-judgment.md',
    'control/sections/07-prohibitions.md',
    'control/sections/05-readme-github.md'
  ]);
  assert.equal(selected.includes('control/sections/04-validation.md'), false);
});

test('selects implementation rules without loading unrelated handoff rules', async () => {
  const selected = await selectControlSections(root, ['implementation']);
  assert.equal(selected.includes('control/sections/02-development.md'), true);
  assert.equal(selected.includes('control/sections/04-validation.md'), true);
  assert.equal(selected.includes('control/sections/06-reusable-assets.md'), true);
  assert.equal(selected.includes('control/sections/03-responsibility.md'), false);
});

test('verifies every control file by SHA-256', async () => {
  const result = await verifyControl(root);
  assert.equal(result.valid, true);
  assert.equal(result.fileCount, 9);
});

test('detects a modified control section', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'control-test-'));
  try {
    await fs.cp(path.join(root, 'control'), path.join(temp, 'control'), { recursive: true });
    await fs.copyFile(path.join(root, 'CHATGPT_WORK_CONTROL.md'), path.join(temp, 'CHATGPT_WORK_CONTROL.md'));
    await fs.appendFile(path.join(temp, 'control/sections/01-judgment.md'), '\nchanged\n');
    await assert.rejects(() => verifyControl(temp), /Control hash mismatch/);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
