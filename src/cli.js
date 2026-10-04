#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';
import {
  CatalogError,
  buildIndex,
  loadAssetSection,
  registerAsset,
  searchCatalog,
  validateAssetDirectory,
  verifyIndex
} from './catalog.js';
import { preflightDelivery, publishDelivery, verifyKbActive } from './kb-delivery.js';
import { prepareKbOutbox } from './kb-outbox.js';
import { exportReusableAssets } from './reusable-asset-export.js';
import { assessRepositoryAssetCandidate, materializeRepositoryAssetCandidate } from './repository-asset-candidate.js';
import { normalizeModuleCatalogCommand, normalizeModuleCatalogErrorCode, sendModuleCatalogRuntimeLog } from './tgserver-zero-producer.js';

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const [rawKey, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) flags[rawKey] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[rawKey] = argv[++i];
    else flags[rawKey] = true;
  }
  return { positionals, flags };
}

function help() {
  console.log(`ModuleCatalog CLI\n\nCommands:\n  search --query <text> [--language <name>] [--runtime <name>] [--layer <layer>] [--asset-type <type>] [--five-v-level <level>] [--tag <tag>] [--limit <n>] [--json]\n  show <asset-id> [--section meta|design|logic|architecture|evidence|manifest|code|tests|all] [--json]\n  validate [asset-id|path]\n  register <candidate-directory>\n  build-index\n  verify-index\n  repository-candidate --repo <git-directory> --revision <sha> --spec <json-file> [--asset-root <path>] [--output <directory>] [--json]\n  export-reusable-assets [asset-id] --output <directory> [--catalog-commit <sha>] [--json]\n  prepare-kb-outbox --outbox <directory> [--json]\n  preflight-kb-delivery <delivery-directory> [--json]\n  publish-kb-delivery <delivery-directory> --kb-root <directory> [--json]\n  verify-kb-active <delivery-directory> --kb-root <directory> [--json]\n\nGlobal:\n  --root <catalog-root>   Default: current directory`);
}

function output(value, json) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else if (typeof value === 'string') console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function requirePositional(positionals, command, label) {
  if (!positionals[0]) throw new CatalogError(`${command} requires ${label}.`, 'MISSING_ARGUMENT');
  return positionals[0];
}

function requireFlag(flags, command, key) {
  const value = flags[key];
  if (!value || value === true) throw new CatalogError(`${command} requires --${key} <directory>.`, 'MISSING_ARGUMENT');
  return value;
}

function requireValueFlag(flags, command, key, label = 'value') {
  const value = flags[key];
  if (!value || value === true) throw new CatalogError(`${command} requires --${key} <${label}>.`, 'MISSING_ARGUMENT');
  return String(value);
}

async function readSpec(file) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    const failure = new CatalogError(`Candidate spec could not be read: ${file}`, 'ASSET_CANDIDATE_SPEC_UNREADABLE');
    failure.details = { cause: error?.code ?? null };
    throw failure;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CatalogError(`Candidate spec is not valid JSON: ${file}: ${error.message}`, 'ASSET_CANDIDATE_SPEC_INVALID_JSON');
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positionals, flags } = parseArgs(rest);
  const root = flags.root ?? process.cwd();

  if (!command || command === 'help' || flags.help) {
    help();
    return;
  }

  if (command === 'search') {
    const results = await searchCatalog(root, {
      query: flags.query ?? positionals.join(' '),
      language: flags.language,
      runtime: flags.runtime,
      layer: flags.layer,
      assetType: flags['asset-type'],
      fiveVLevel: flags['five-v-level'],
      tag: flags.tag,
      dependency: flags.dependency,
      constraint: flags.constraint,
      limit: flags.limit
    });
    output(results, flags.json);
    return;
  }

  if (command === 'show') {
    if (!positionals[0]) throw new CatalogError('show requires an asset id.', 'MISSING_ARGUMENT');
    output(await loadAssetSection(root, positionals[0], flags.section ?? 'meta'), flags.json);
    return;
  }

  if (command === 'validate') {
    const target = positionals[0];
    const assetPath = target && !target.includes('/') && !target.includes('\\') ? `${root}/assets/${target}` : (target ?? root);
    const result = await validateAssetDirectory(assetPath, { verifyManifest: Boolean(target && !target.includes('/') && !target.includes('\\')) });
    output({ valid: true, id: result.meta.id, assetHash: result.manifest.assetHash }, flags.json);
    return;
  }

  if (command === 'register') {
    if (!positionals[0]) throw new CatalogError('register requires a candidate directory.', 'MISSING_ARGUMENT');
    output(await registerAsset(root, positionals[0]), flags.json);
    return;
  }

  if (command === 'build-index') {
    const index = await buildIndex(root);
    output({ assetCount: index.assetCount, generatedAt: index.generatedAt }, flags.json);
    return;
  }

  if (command === 'verify-index') {
    output({ valid: true, ...await verifyIndex(root) }, flags.json);
    return;
  }

  if (command === 'repository-candidate') {
    const repoPath = requireValueFlag(flags, command, 'repo', 'git-directory');
    const revision = requireValueFlag(flags, command, 'revision', 'sha');
    const specPath = requireValueFlag(flags, command, 'spec', 'json-file');
    const input = {
      repoPath,
      revision,
      assetRoot: typeof flags['asset-root'] === 'string' ? flags['asset-root'] : '',
      spec: await readSpec(specPath)
    };
    const result = typeof flags.output === 'string'
      ? await materializeRepositoryAssetCandidate(root, input, flags.output)
      : await assessRepositoryAssetCandidate(input);
    output(result, flags.json);
    return;
  }

  if (command === 'export-reusable-assets') {
    const outputDirectory = requireFlag(flags, command, 'output');
    const result = await exportReusableAssets(root, outputDirectory, {
      assetId: positionals[0] ?? null,
      catalogCommit: typeof flags['catalog-commit'] === 'string' ? flags['catalog-commit'] : null
    });
    output(result, flags.json);
    return;
  }

  if (command === 'prepare-kb-outbox') {
    const outbox = requireFlag(flags, command, 'outbox');
    output(await prepareKbOutbox(root, outbox), flags.json);
    return;
  }

  if (command === 'preflight-kb-delivery') {
    const delivery = requirePositional(positionals, command, 'a delivery directory');
    output(await preflightDelivery(root, delivery), flags.json);
    return;
  }

  if (command === 'publish-kb-delivery') {
    const delivery = requirePositional(positionals, command, 'a delivery directory');
    const kbRoot = requireFlag(flags, command, 'kb-root');
    const current = await verifyKbActive(root, delivery, kbRoot);
    if (current.status === 'COMPLETE' || current.status === 'ACCEPTED' || current.status === 'PROCESSING' || current.status === 'PUBLISHED') {
      output(current, flags.json);
      return;
    }
    output(await publishDelivery(root, delivery, kbRoot), flags.json);
    return;
  }

  if (command === 'verify-kb-active') {
    const delivery = requirePositional(positionals, command, 'a delivery directory');
    const kbRoot = requireFlag(flags, command, 'kb-root');
    output(await verifyKbActive(root, delivery, kbRoot), flags.json);
    return;
  }

  throw new CatalogError(`Unknown command: ${command}`, 'UNKNOWN_COMMAND');
}

const runtimeStartedAt = Date.now();
const runtimeCommand = normalizeModuleCatalogCommand(process.argv[2]);

main().then(async () => {
  await sendModuleCatalogRuntimeLog({
    status: 'completed',
    command: runtimeCommand,
    durationMs: Date.now() - runtimeStartedAt
  });
}).catch(async (error) => {
  await sendModuleCatalogRuntimeLog({
    status: 'failed',
    command: runtimeCommand,
    durationMs: Date.now() - runtimeStartedAt,
    errorCode: normalizeModuleCatalogErrorCode(error instanceof CatalogError ? error.code : 'UNEXPECTED_ERROR')
  });
  if (error instanceof CatalogError) {
    console.error(JSON.stringify({ ok: false, code: error.code, error: error.message, details: error.details ?? null }));
    process.exitCode = 1;
    return;
  }
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
