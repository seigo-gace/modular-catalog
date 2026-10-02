#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { preflightDelivery } from '../src/kb-delivery.js';
import { validateFactoryRequest } from '../src/chat-control-plane.js';

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    flags[key] = argv[i + 1];
    i += 1;
  }
  return flags;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

const flags = parseArgs(process.argv.slice(2));
for (const key of ['request', 'source-root', 'snapshot', 'output']) {
  if (!flags[key]) throw new Error(`Missing --${key}`);
}

const request = validateFactoryRequest(await readJson(flags.request));
const sourceRoot = path.resolve(flags['source-root']);
const snapshot = path.resolve(flags.snapshot);
const output = path.resolve(flags.output);
const preflight = await preflightDelivery(sourceRoot, snapshot);

if (preflight.catalogCommit !== request.catalog_commit) {
  const error = new Error('Factory snapshot commit does not match Chat request.');
  error.code = 'CHAT_FACTORY_RESULT_COMMIT_MISMATCH';
  throw error;
}

let contractUnknownCount = 0;
let applicabilityEmptyCount = 0;
let knownUnverifiedCount = 0;
const layerValues = new Set();

for (const item of preflight.manifest.assets) {
  const asset = await readJson(path.join(snapshot, 'assets', item.id, 'asset.json'));
  if (asset.contract?.status !== 'known') contractUnknownCount += 1;
  const applicability = asset.applicability ?? {};
  const applicabilityFields = ['use_when', 'do_not_use_when', 'preconditions', 'required_context', 'failure_conditions'];
  if (applicabilityFields.every((field) => Array.isArray(applicability[field]) && applicability[field].length === 0)) applicabilityEmptyCount += 1;
  knownUnverifiedCount += Array.isArray(asset.verification?.known_unverified) ? asset.verification.known_unverified.length : 0;
  for (const layer of Array.isArray(asset.classification?.layers) ? asset.classification.layers : []) {
    if (String(layer).trim()) layerValues.add(String(layer).trim());
  }
}

const result = {
  schema_version: 'modulecatalog.chat-factory-result.v1',
  request_id: request.request_id,
  repository: request.repository,
  catalog_commit: request.catalog_commit,
  manifest_sha256: preflight.manifestSha256,
  review_rule_version: request.review_rule_version,
  asset_count: preflight.assetCount,
  knowledge_unit_count: preflight.knowledgeUnitCount,
  relationship_count: preflight.relationshipCount,
  case_count: preflight.caseCount,
  contract_unknown_count: contractUnknownCount,
  applicability_empty_count: applicabilityEmptyCount,
  known_unverified_count: knownUnverifiedCount,
  layer_values: [...layerValues].sort(),
  architecture_review_required: true,
  real_cross_project_reuse_proven: false,
  factory_status: 'FACTORY_READY_FOR_GPT_REVIEW'
};

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result));
