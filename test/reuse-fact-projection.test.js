import assert from 'node:assert/strict';
import test from 'node:test';
import { projectExplicitReuseFacts } from '../src/reuse-fact-projection.js';

function project(overrides = {}) {
  return projectExplicitReuseFacts({
    meta: {
      name: 'Reusable Capability',
      purpose: 'Evaluate a reusable capability.',
      dependencies: [],
      constraints: ['single responsibility', 'fail closed where input is insufficient'],
      ...overrides.meta
    },
    sections: {
      'design.md': '# Design\nFailure Mode Explorer is the asset name.\nFail closed on structurally invalid input.\n',
      'logic.md': '# Logic\nInput object -> deterministic validation/derivation -> explicit PASS/READY/BLOCKED/UNKNOWN style result.\n',
      'architecture.md': '# Architecture\nNo external side effects.\n',
      ...overrides.sections
    },
    structure: {
      contractInputs: ['run({input}={})'],
      contractOutputs: ['run -> {status:"PASS"}', 'run -> {status:"BLOCKED",reason:"INVALID_INPUT"}'],
      ...overrides.structure
    },
    evidence: {
      normal: { passed: true },
      user: { passed: true },
      ...overrides.evidence
    }
  });
}

test('projects only explicit failure statements and exact failure-bearing outputs', () => {
  const result = project();
  assert.equal(result.contract.status, 'known');
  assert.deepEqual(result.applicability.use_when, ['Evaluate a reusable capability.']);
  assert.equal(result.applicability.failure_conditions.includes('fail closed where input is insufficient'), true);
  assert.equal(result.applicability.failure_conditions.includes('Fail closed on structurally invalid input.'), true);
  assert.equal(result.applicability.failure_conditions.includes('run -> {status:"BLOCKED",reason:"INVALID_INPUT"}'), true);
  assert.equal(result.applicability.failure_conditions.some((value) => value.includes('Failure Mode Explorer')), false);
  assert.equal(result.applicability.failure_conditions.some((value) => value.includes('PASS/READY/BLOCKED/UNKNOWN style result')), false);
  assert.equal(result.contract.side_effects, 'No external side effects.');
});

test('replaces name-only purpose with concise interface-derived reuse condition', () => {
  const result = project({ meta: { name: 'Claim Extractor', purpose: 'Claim Extractor' }, structure: { contractInputs: ['run({items})'], contractOutputs: ["run -> {status:'PASS',claims}"] } });
  assert.deepEqual(result.applicability.use_when, ['Use when the required call interface matches run({items}).']);
  assert.equal(result.applicability.use_when[0].includes('recorded outputs'), false);
  assert.equal(result.derived_fields.some((entry) => entry.field === 'applicability.use_when' && entry.source === 'ast-grep observed input interface because meta.purpose is generic'), true);
});

test('replaces generic single-responsibility skill purpose with interface-derived reuse condition', () => {
  const result = project({ meta: { name: 'Test Discovery', purpose: 'Test Discoveryを1責務の独立Skillとして提供する。' } });
  assert.equal(result.applicability.use_when[0], 'Use when the required call interface matches run({input}={}).');
  assert.equal(result.applicability.use_when[0].includes('1責務の独立Skill'), false);
});

test('does not claim a known contract without observed input/output and passed evidence', () => {
  assert.equal(project({ structure: { contractOutputs: [] } }).contract.status, 'unknown');
  assert.equal(project({ evidence: { user: { passed: false } } }).contract.status, 'unknown');
});

test('generic purpose remains unprojected when no complete interface is observed', () => {
  const result = project({ meta: { name: 'Claim Extractor', purpose: 'Claim Extractor' }, structure: { contractOutputs: [] } });
  assert.deepEqual(result.applicability.use_when, []);
});

test('does not synthesize negative applicability without explicit do-not-use wording', () => {
  const result = project({ sections: { 'design.md': '# Design\nDo not replace Business Authority.\n' } });
  assert.deepEqual(result.applicability.do_not_use_when, []);
});
