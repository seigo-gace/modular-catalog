const FAILURE_PATTERN = /\b(?:fail(?:ed|ure|\s+closed)?|invalid|insufficient|ambiguous|missing|unavailable|blocked|reject(?:ed|ion)?)\b/i;
const DO_NOT_USE_PATTERN = /\b(?:do not use|must not be used|never use|not for use|forbidden to use)\b/i;
const SIDE_EFFECT_PATTERN = /(?:\bno\b.*\bside effects?\b|\bwithout\b.*\bside effects?\b|\bdo not execute side effects?\b)/i;

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

function sentences(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/^\s*#+\s*/, '').trim().split(/(?<=[.!?])\s+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function sourcedStatements(sections) {
  const result = [];
  for (const file of ['design.md', 'logic.md', 'architecture.md']) {
    for (const text of sentences(sections?.[file])) result.push({ text, source: file });
  }
  return result;
}

export function projectExplicitReuseFacts({ meta, sections, structure, evidence }) {
  const statements = sourcedStatements(sections);
  const constraintStatements = (meta.constraints ?? []).map((text) => ({ text: String(text).trim(), source: 'meta.json#/constraints' }));
  const allStatements = [...constraintStatements, ...statements].filter((entry) => entry.text);
  const failureStatements = allStatements.filter((entry) => FAILURE_PATTERN.test(entry.text));
  const doNotUseStatements = allStatements.filter((entry) => DO_NOT_USE_PATTERN.test(entry.text));
  const sideEffectStatement = allStatements.find((entry) => SIDE_EFFECT_PATTERN.test(entry.text)) ?? null;

  const contractInputs = unique(structure?.contractInputs ?? []);
  const contractOutputs = unique(structure?.contractOutputs ?? []);
  const interfaceObserved = contractInputs.length > 0 && contractOutputs.length > 0;
  const verificationPassed = evidence?.normal?.passed === true && evidence?.user?.passed === true;

  const applicability = {
    use_when: meta.purpose?.trim() ? [meta.purpose.trim()] : [],
    do_not_use_when: unique(doNotUseStatements.map((entry) => entry.text)),
    preconditions: unique(meta.dependencies ?? []),
    required_context: contractInputs,
    failure_conditions: unique(failureStatements.map((entry) => entry.text))
  };

  const contract = {
    status: interfaceObserved && verificationPassed ? 'known' : 'unknown',
    inputs: contractInputs,
    outputs: contractOutputs,
    error_behavior: failureStatements.length ? unique(failureStatements.map((entry) => entry.text)).join(' | ') : null,
    side_effects: sideEffectStatement?.text ?? null
  };

  const derived_fields = [];
  if (applicability.use_when.length) derived_fields.push({ field: 'applicability.use_when', type: 'deterministic-derived', source: 'meta.purpose', verified: false });
  if (applicability.do_not_use_when.length) derived_fields.push({ field: 'applicability.do_not_use_when', type: 'deterministic-derived', source: 'explicit do-not-use statements from meta/design/logic/architecture', verified: false });
  if (applicability.preconditions.length) derived_fields.push({ field: 'applicability.preconditions', type: 'deterministic-derived', source: 'meta.dependencies', verified: false });
  if (applicability.required_context.length) derived_fields.push({ field: 'applicability.required_context', type: 'deterministic-derived', source: 'ast-grep exported function signatures', verified: false });
  if (applicability.failure_conditions.length) derived_fields.push({ field: 'applicability.failure_conditions', type: 'deterministic-derived', source: 'explicit failure statements from meta/design/logic/architecture', verified: false });
  if (contract.status === 'known') derived_fields.push({ field: 'contract.status', type: 'deterministic-derived', source: 'ast-grep observed input/output interface + normal/user evidence PASS', verified: false });
  if (contract.error_behavior) derived_fields.push({ field: 'contract.error_behavior', type: 'deterministic-derived', source: 'explicit failure statements from meta/design/logic/architecture', verified: false });
  if (contract.side_effects) derived_fields.push({ field: 'contract.side_effects', type: 'deterministic-derived', source: sideEffectStatement.source, verified: false });

  return Object.freeze({ applicability, contract, derived_fields });
}
