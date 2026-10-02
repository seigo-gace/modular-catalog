import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSourceFile, analyzeSourceFiles, supportedStructuralLanguage } from '../src/structural-analyzer.js';

test('ast-grep analyzer deterministically extracts JS/TS structural facts without mutation', async () => {
  const source = `import fs from 'node:fs';
export function loadConfig(file) {
  return fs.readFileSync(file, 'utf8');
}
class Runner {
  run(task) {
    return task();
  }
}
const value = loadConfig('config.json');
`;
  const first = await analyzeSourceFile({ sourcePath: 'src/example.js', content: source });
  const second = await analyzeSourceFile({ sourcePath: 'src/example.js', content: source });

  assert.deepEqual(second, first);
  assert.equal(first.status, 'ANALYZED');
  assert.equal(first.facts.some((fact) => fact.kind === 'import' && fact.source === 'node:fs'), true);
  assert.equal(first.facts.some((fact) => fact.kind === 'function' && fact.name === 'loadConfig'), true);
  assert.equal(first.facts.some((fact) => fact.kind === 'class' && fact.name === 'Runner'), true);
  assert.equal(first.facts.some((fact) => fact.kind === 'call' && fact.target === 'fs.readFileSync'), true);
  assert.equal(first.facts.some((fact) => fact.kind === 'call' && fact.target === 'loadConfig'), true);
  assert.equal(first.facts.every((fact) => Number.isInteger(fact.start_line) && fact.start_line > 0), true);
});

test('structural analyzer keeps unsupported languages explicit instead of guessing', async () => {
  assert.equal(supportedStructuralLanguage('src/example.py'), null);
  const unsupported = await analyzeSourceFile({ sourcePath: 'src/example.py', content: 'print("hello")' });
  assert.deepEqual(unsupported, {
    source_path: 'src/example.py',
    status: 'UNSUPPORTED_LANGUAGE',
    language: null,
    facts: []
  });
});

test('multi-file structural analysis is path-stable', async () => {
  const results = await analyzeSourceFiles([
    { sourcePath: 'src/z.js', content: 'export function z() { return 1; }' },
    { sourcePath: 'src/a.ts', content: 'export function a(): number { return 1; }' }
  ]);
  assert.deepEqual(results.map((item) => item.source_path), ['src/a.ts', 'src/z.js']);
  assert.equal(results.every((item) => item.status === 'ANALYZED'), true);
});
