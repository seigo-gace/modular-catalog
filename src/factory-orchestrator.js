import { CatalogError } from './catalog.js';
import { asteraEvidenceSearchBoundary } from './astera-qce-client.js';
import { inspectRepositoryChanges } from './repository-intake.js';

const FACTORY_RUN_SCHEMA = 'modulecatalog.factory-inspection.v1';

function requiredString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new CatalogError(`${field} is required.`, 'FACTORY_INPUT_INVALID');
  return normalized;
}

function exactRevision(value, field = 'revision') {
  const revision = requiredString(value, field);
  if (!/^[a-f0-9]{40}$/i.test(revision)) {
    throw new CatalogError(`${field} must be an exact 40-character Git commit.`, 'FACTORY_INPUT_INVALID');
  }
  return revision.toLowerCase();
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function changedPaths(intake) {
  return uniqueStrings((Array.isArray(intake?.changes) ? intake.changes : []).flatMap((change) => [change?.old_path, change?.path]));
}

function logReference(log) {
  const identity = String(log?.hash ?? log?.id ?? log?.timestamp ?? '').trim();
  return identity ? `tg:${identity}` : null;
}

export function deriveRuntimeSignals(logs) {
  const groups = new Map();
  for (const log of Array.isArray(logs) ? logs : []) {
    const severity = String(log?.severity ?? '').toLowerCase();
    if (!['error', 'warn'].includes(severity)) continue;
    const message = String(log?.message ?? '').trim();
    if (!message) continue;
    const key = String(log?.hash ?? '').trim() || `${severity}:${message}`;
    const current = groups.get(key) ?? [];
    current.push(log);
    groups.set(key, current);
  }

  const signals = [];
  for (const [key, entries] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (entries.length < 2) continue;
    signals.push(Object.freeze({
      type: 'REPEATED_ERROR_LOG',
      summary: `TGserver observed the same warn/error signal ${entries.length} times in the scoped project query.`,
      evidence_refs: uniqueStrings(entries.map(logReference)),
      occurrence_count: entries.length,
      grouping_key: key
    }));
  }
  return Object.freeze(signals);
}

export async function runFactoryInspection(input = {}, adapters = {}) {
  const requestedRepo = requiredString(input.repo, 'repo');
  const requestedRevision = exactRevision(input.revision);
  const previousRevision = input.previous_revision == null ? null : exactRevision(input.previous_revision, 'previous_revision');
  const intake = await inspectRepositoryChanges({
    repoPath: requestedRepo,
    currentRevision: requestedRevision,
    previousRevision
  });
  const repo = intake.repository;
  const revision = intake.current_revision;
  const explicitPaths = uniqueStrings(input.paths);
  const paths = explicitPaths.length ? explicitPaths : changedPaths(intake);
  const projectId = input.project_id == null ? null : requiredString(input.project_id, 'project_id');
  const explicitSignals = Array.isArray(input.signals) ? input.signals : [];
  const evidenceRefs = uniqueStrings(input.evidence_refs);
  const testEvidence = Array.isArray(input.test_evidence) ? input.test_evidence : [];

  let tgObservation = Object.freeze({ status: 'SKIPPED', hits: [], returned: 0 });
  if (adapters.tgserver) {
    if (!projectId) throw new CatalogError('project_id is required when TGserver intake is enabled.', 'FACTORY_INPUT_INVALID');
    const result = await adapters.tgserver.search({
      query: input.tg_query ?? '',
      project_id: projectId,
      ...(input.tg_severity ? { severity: input.tg_severity } : {}),
      ...(input.tg_from ? { from: input.tg_from } : {}),
      ...(input.tg_to ? { to: input.tg_to } : {})
    });
    tgObservation = Object.freeze({ status: 'OBSERVED', ...result });
  }

  const derivedSignals = deriveRuntimeSignals(tgObservation.hits);
  const signals = [...explicitSignals, ...derivedSignals];
  const runtimeEvidenceRefs = uniqueStrings(tgObservation.hits.map(logReference));

  let debug = Object.freeze({ status: 'SKIPPED', decision: null, execution: null });
  if (adapters.debugController) {
    const decision = await adapters.debugController.decide({
      repo,
      revision,
      paths,
      signals,
      logs: tgObservation.hits,
      evidenceRefs: uniqueStrings([...evidenceRefs, ...runtimeEvidenceRefs]),
      testEvidence
    });
    if (decision.action === 'SKIP') {
      debug = Object.freeze({ status: 'SKIPPED', decision, execution: null });
    } else {
      if (!adapters.debugAi || typeof adapters.debugAi.execute !== 'function') {
        throw new CatalogError(`DebugAI is required for ${decision.action} but is not configured.`, 'DEBUGAI_MCP_NOT_CONFIGURED');
      }
      const execution = await adapters.debugAi.execute(decision);
      debug = Object.freeze({ status: 'COMPLETED', decision, execution });
    }
  } else if (signals.length > 0) {
    throw new CatalogError('Debug Controller is required when actionable Factory signals exist.', 'DEBUG_CONTROLLER_NOT_CONFIGURED');
  }

  let qce = Object.freeze({ status: 'SKIPPED', result: null });
  if (input.qce_request) {
    if (!adapters.qce || typeof adapters.qce.evaluate !== 'function') {
      throw new CatalogError('Astera QCE request was supplied but the QCE adapter is not configured.', 'QCE_NOT_CONFIGURED');
    }
    const result = await adapters.qce.evaluate(input.qce_request);
    qce = Object.freeze({ status: 'EVALUATED', result });
  }

  return Object.freeze({
    schema_version: FACTORY_RUN_SCHEMA,
    status: 'INSPECTION_COMPLETE',
    repo,
    revision,
    previous_revision: intake.previous_revision,
    repository_intake: intake,
    project_id: projectId,
    paths,
    tgserver: tgObservation,
    signals: Object.freeze(signals),
    debug,
    qce,
    astera_evidence_search: asteraEvidenceSearchBoundary(),
    mutation: Object.freeze({ source_repository: false, kb_runtime: false })
  });
}
