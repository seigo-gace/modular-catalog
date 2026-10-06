import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CatalogError } from './catalog.js';

function requiredString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new CatalogError(`${field} is required.`, 'REPOSITORY_INTAKE_INVALID');
  return normalized;
}

function exactCommit(value, field) {
  const commit = requiredString(value, field);
  if (!/^[a-f0-9]{40}$/i.test(commit)) {
    throw new CatalogError(`${field} must be an exact 40-character Git commit.`, 'REPOSITORY_INTAKE_INVALID');
  }
  return commit.toLowerCase();
}

function git(repoPath, args, code = 'REPOSITORY_INTAKE_GIT_FAILED') {
  try {
    return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trimEnd();
  } catch (error) {
    const failure = new CatalogError(`Git command failed: git ${args.join(' ')}`, code);
    failure.details = { status: error?.status ?? null, stderr: String(error?.stderr ?? '').trim() || null };
    throw failure;
  }
}

async function assertRepository(repoPath) {
  const resolved = path.resolve(requiredString(repoPath, 'repoPath'));
  let stat;
  try { stat = await fs.stat(resolved); } catch { stat = null; }
  if (!stat?.isDirectory()) throw new CatalogError(`Repository directory is unavailable: ${resolved}`, 'REPOSITORY_NOT_AVAILABLE');
  if (git(resolved, ['rev-parse', '--is-inside-work-tree']) !== 'true') {
    throw new CatalogError(`Not a Git work tree: ${resolved}`, 'REPOSITORY_NOT_AVAILABLE');
  }
  return resolved;
}

function resolveCommit(repoPath, requested, field) {
  const exact = exactCommit(requested, field);
  const resolved = git(repoPath, ['rev-parse', `${exact}^{commit}`], 'REPOSITORY_REVISION_UNRESOLVED').trim().toLowerCase();
  if (resolved !== exact) throw new CatalogError(`${field} did not resolve to the requested exact commit.`, 'REPOSITORY_REVISION_UNRESOLVED');
  return resolved;
}

function parseNameStatus(text) {
  const changes = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split('\t');
    const rawStatus = fields[0] ?? '';
    const kind = rawStatus[0] ?? '';
    if (kind === 'R' || kind === 'C') {
      if (fields.length < 3) throw new CatalogError(`Invalid Git name-status row: ${line}`, 'REPOSITORY_DIFF_INVALID');
      changes.push(Object.freeze({
        status: kind === 'R' ? 'RENAMED' : 'COPIED',
        similarity: Number.parseInt(rawStatus.slice(1), 10),
        old_path: fields[1],
        path: fields[2]
      }));
      continue;
    }
    const status = ({ A: 'ADDED', M: 'MODIFIED', D: 'DELETED', T: 'TYPE_CHANGED', U: 'UNMERGED' })[kind];
    if (!status || fields.length < 2) throw new CatalogError(`Unsupported Git name-status row: ${line}`, 'REPOSITORY_DIFF_INVALID');
    changes.push(Object.freeze({ status, path: fields[1] }));
  }
  return Object.freeze(changes);
}

function fullSnapshotChanges(repoPath, revision) {
  const files = git(repoPath, ['ls-tree', '-r', '--name-only', revision]).split(/\r?\n/).filter(Boolean).sort();
  return Object.freeze(files.map((file) => Object.freeze({ status: 'ADDED', path: file })));
}

function assetIdForPath(filePath) {
  const normalized = String(filePath ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
  const match = /^assets\/([^/]+)\//.exec(normalized);
  return match?.[1] ?? null;
}

function projection(changes) {
  const assetIds = new Set();
  const unmapped = new Set();
  for (const change of changes) {
    const candidates = [change.path, change.old_path].filter(Boolean);
    let mapped = false;
    for (const file of candidates) {
      const assetId = assetIdForPath(file);
      if (assetId) {
        assetIds.add(assetId);
        mapped = true;
      }
    }
    if (!mapped && change.path) unmapped.add(change.path);
  }
  return Object.freeze({
    affected_asset_ids: Object.freeze([...assetIds].sort()),
    unmapped_paths: Object.freeze([...unmapped].sort())
  });
}

export async function inspectRepositoryChanges({ repoPath, currentRevision, previousRevision = null } = {}) {
  const repository = await assertRepository(repoPath);
  const current = resolveCommit(repository, currentRevision, 'currentRevision');
  const previous = previousRevision == null ? null : resolveCommit(repository, previousRevision, 'previousRevision');
  if (previous === current) {
    return Object.freeze({
      schema_version: 'modulecatalog.repository-intake.v1',
      mode: 'UNCHANGED',
      repository,
      previous_revision: previous,
      current_revision: current,
      changes: Object.freeze([]),
      affected_asset_ids: Object.freeze([]),
      unmapped_paths: Object.freeze([])
    });
  }

  const changes = previous
    ? parseNameStatus(git(repository, ['diff', '--name-status', '--find-renames', previous, current, '--']))
    : fullSnapshotChanges(repository, current);
  const mapped = projection(changes);
  return Object.freeze({
    schema_version: 'modulecatalog.repository-intake.v1',
    mode: previous ? 'INCREMENTAL' : 'FULL_SNAPSHOT',
    repository,
    previous_revision: previous,
    current_revision: current,
    changes,
    ...mapped
  });
}

export function mapChangedPathsToCatalogAssets(changes) {
  return projection(Array.isArray(changes) ? changes : []);
}
