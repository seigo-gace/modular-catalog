#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;
    flags[value.slice(2)] = argv[i + 1];
    i += 1;
  }
  return flags;
}

function splitCommand(command) {
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
  let match;
  while ((match = pattern.exec(command)) !== null) tokens.push(match[1] ?? match[2] ?? match[3]);
  return tokens;
}

function parseRecordedNodeCommand(command) {
  const raw = String(command ?? '').trim();
  if (!raw || /[;&|><`]/.test(raw)) throw new Error(`Unsupported recorded command syntax: ${raw || '<empty>'}`);
  const tokens = splitCommand(raw);
  if (tokens[0] !== 'node') throw new Error(`Portable reuse only executes recorded Node commands: ${raw}`);
  const args = tokens.slice(1);
  if (!args.length) throw new Error(`Recorded Node command has no arguments: ${raw}`);
  return { raw, args };
}

function assertArgumentPathsStayInside(assetRoot, args) {
  for (const value of args) {
    if (!value || value.startsWith('-')) continue;
    if (!/[\\/]/.test(value) && !/\.(?:c?js|mjs|json)$/i.test(value)) continue;
    if (path.isAbsolute(value)) throw new Error(`Absolute path is forbidden in portable reuse command: ${value}`);
    const resolved = path.resolve(assetRoot, value);
    if (resolved !== assetRoot && !resolved.startsWith(assetRoot + path.sep)) {
      throw new Error(`Portable reuse command escapes copied asset root: ${value}`);
    }
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function removeTree(directory) {
  await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

const flags = parseArgs(process.argv.slice(2));
const root = path.resolve(flags.root ?? process.cwd());
const assetsRoot = path.join(root, 'assets');
const output = flags['json-output'] ? path.resolve(flags['json-output']) : null;
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'modulecatalog-portable-reuse-'));
const results = [];

try {
  const entries = (await fs.readdir(assetsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const assetId = entry.name;
    const sourceAsset = path.join(assetsRoot, assetId);
    const copiedAsset = path.join(temporaryRoot, assetId);
    await fs.cp(sourceAsset, copiedAsset, { recursive: true, force: false, errorOnExist: false });
    const evidence = await readJson(path.join(copiedAsset, 'evidence.json'));
    const commands = [];

    for (const kind of ['normal', 'user']) {
      const recorded = evidence?.[kind]?.commands;
      if (!Array.isArray(recorded) || recorded.length === 0) throw new Error(`${assetId}: evidence.${kind}.commands is empty.`);
      for (const command of recorded) {
        const parsed = parseRecordedNodeCommand(command);
        assertArgumentPathsStayInside(copiedAsset, parsed.args);
        const execution = spawnSync(process.execPath, parsed.args, {
          cwd: copiedAsset,
          encoding: 'utf8',
          timeout: 60_000,
          env: { ...process.env }
        });
        commands.push({ kind, command: parsed.raw, exit_code: execution.status });
        if (execution.error) throw execution.error;
        if (execution.status !== 0) {
          const detail = [execution.stdout, execution.stderr].filter(Boolean).join('\n').trim();
          throw new Error(`${assetId}: portable ${kind} command failed: ${parsed.raw}${detail ? `\n${detail}` : ''}`);
        }
      }
    }

    results.push({ asset_id: assetId, status: 'PASS', command_count: commands.length, commands });
  }

  const report = {
    schema_version: 'modulecatalog.portable-reuse-smoke.v1',
    status: 'PASS',
    boundary: 'Each registered asset was copied outside the Catalog working tree and its recorded normal/user Node test commands were executed from the copied asset root. This proves isolated portability smoke only; it does not prove real integration into an unrelated project.',
    asset_count: results.length,
    passed_asset_count: results.filter((entry) => entry.status === 'PASS').length,
    command_count: results.reduce((sum, entry) => sum + entry.command_count, 0),
    assets: results
  };

  if (output) {
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify(report));
} finally {
  await removeTree(temporaryRoot);
}
