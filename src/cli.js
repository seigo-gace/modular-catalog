#!/usr/bin/env node
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
import { exportReusableAssets } from './reusable-asset-export.js';

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
  console.log(`ModuleCatalog CLI\n\nCommands:\n  search --query <text> [--language <name>] [--runtime <name>] [--layer <layer>] [--tag <tag>] [--limit <n>] [--json]\n  show <asset-id> [--section meta|design|logic|architecture|evidence|manifest|code|tests|all] [--json]\n  validate [asset-id|path]\n  register <candidate-directory>\n  build-index\n  verify-index\n  export-reusable-assets [asset-id] --output <directory> [--catalog-commit <sha>] [--json]\n  preflight-kb-delivery <delivery-directory> [--json]\n  publish-kb-delivery <delivery-directory> --kb-root <directory> [--json]\n  verify-kb-active <delivery-directory> --kb-root <directory> [--json]\n\nGlobal:\n  --root <catalog-root>   Default: current directory`);
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

  if (command === 'export-reusable-assets') {
    const outputDirectory = requireFlag(flags, command, 'output');
    const result = await exportReusableAssets(root, outputDirectory, {
      assetId: positionals[0] ?? null,
      catalogCommit: typeof flags['catalog-commit'] === 'string' ? flags['catalog-commit'] : null
    });
    output(result, flags.json);
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

main().catch((error) => {
  if (error instanceof CatalogError) {
    console.error(JSON.stringify({ ok: false, code: error.code, error: error.message, details: error.details ?? null }));
    process.exitCode = 1;
    return;
  }
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
