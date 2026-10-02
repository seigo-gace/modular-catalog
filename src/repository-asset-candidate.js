import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CatalogError, validateAssetDirectory, validateMeta } from './catalog.js';
import { inspectRepositoryChanges } from './repository-intake.js';

const SPEC_SCHEMA = 'modulecatalog.repository-asset-candidate-spec.v1';
const RESULT_SCHEMA = 'modulecatalog.repository-asset-candidate.v1';
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function requiredString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new CatalogError(`${field} is required.`, 'ASSET_CANDIDATE_SPEC_INVALID');
  return normalized;
}

function safeRelative(value, field) {
  const raw = requiredString(value, field).replaceAll('\\', '/');
  if (raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) {
    throw new CatalogError(`${field} must be repository-relative.`, 'ASSET_CANDIDATE_PATH_INVALID');
  }
  const normalized = path.posix.normalize(raw).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new CatalogError(`${field} must stay inside the selected repository root.`, 'ASSET_CANDIDATE_PATH_INVALID');
  }
  return normalized;
}

function exactCommit(value, field) {
  const revision = requiredString(value, field).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    throw new CatalogError(`${field} must be an exact 40-character Git commit.`, 'ASSET_CANDIDATE_SPEC_INVALID');
  }
  return revision;
}

function stringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new CatalogError(`${field} must be a non-empty array.`, 'ASSET_CANDIDATE_SPEC_INVALID');
  }
  return value.map((item, index) => safeRelative(item, `${field}[${index}]`));
}

function validateSpec(spec, revision) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new CatalogError('Candidate spec must be an object.', 'ASSET_CANDIDATE_SPEC_INVALID');
  }
  if (spec.schema_version !== SPEC_SCHEMA) {
    throw new CatalogError(`Candidate spec schema_version must be ${SPEC_SCHEMA}.`, 'ASSET_CANDIDATE_SPEC_INVALID');
  }
  const declaration = validateMeta(structuredClone(spec.declaration));
  if (exactCommit(declaration.source.commit, 'declaration.source.commit') !== revision) {
    throw new CatalogError('declaration.source.commit must equal the exact inspected repository revision.', 'ASSET_CANDIDATE_REVISION_MISMATCH');
  }
  const files = spec.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new CatalogError('Candidate spec files object is required.', 'ASSET_CANDIDATE_SPEC_INVALID');
  }
  const normalized = {
    design: safeRelative(files.design, 'files.design'),
    logic: safeRelative(files.logic, 'files.logic'),
    architecture: safeRelative(files.architecture, 'files.architecture'),
    evidence: safeRelative(files.evidence, 'files.evidence'),
    source: stringArray(files.source, 'files.source'),
    normal_tests: stringArray(files.normal_tests, 'files.normal_tests'),
    user_tests: stringArray(files.user_tests, 'files.user_tests')
  };
  const all = [normalized.design, normalized.logic, normalized.architecture, normalized.evidence, ...normalized.source, ...normalized.normal_tests, ...normalized.user_tests];
  if (new Set(all).size !== all.length) {
    throw new CatalogError('Candidate spec maps the same repository path more than once.', 'ASSET_CANDIDATE_SPEC_INVALID');
  }
  return Object.freeze({ declaration: Object.freeze(declaration), files: Object.freeze(normalized) });
}

function gitBuffer(repo, args, code) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: null, maxBuffer: MAX_FILE_BYTES + 1024 * 1024 });
  } catch (error) {
    const failure = new CatalogError(`Git command failed: git ${args.join(' ')}`, code);
    failure.details = { status: error?.status ?? null, stderr: Buffer.isBuffer(error?.stderr) ? error.stderr.toString('utf8').trim() || null : String(error?.stderr ?? '').trim() || null };
    throw failure;
  }
}

function revisionPath(assetRoot, relative) {
  return assetRoot ? `${assetRoot}/${relative}` : relative;
}

function readRevisionFile(repo, revision, assetRoot, relative) {
  const sourcePath = revisionPath(assetRoot, relative);
  let bytes;
  try {
    bytes = gitBuffer(repo, ['show', `${revision}:${sourcePath}`], 'ASSET_CANDIDATE_FILE_UNAVAILABLE');
  } catch (error) {
    if (error?.code === 'ASSET_CANDIDATE_FILE_UNAVAILABLE') return null;
    throw error;
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new CatalogError(`Candidate file exceeds 2 MiB limit: ${sourcePath}`, 'FILE_TOO_LARGE');
  }
  return Object.freeze({ source_path: sourcePath, bytes });
}

function mappedFiles(spec) {
  return Object.freeze([
    Object.freeze({ role: 'design', source: spec.files.design, target: 'design.md' }),
    Object.freeze({ role: 'logic', source: spec.files.logic, target: 'logic.md' }),
    Object.freeze({ role: 'architecture', source: spec.files.architecture, target: 'architecture.md' }),
    Object.freeze({ role: 'evidence', source: spec.files.evidence, target: 'evidence.json' }),
    ...spec.files.source.map((source) => Object.freeze({ role: 'source', source, target: path.posix.join('source', source) })),
    ...spec.files.normal_tests.map((source) => Object.freeze({ role: 'normal_test', source, target: path.posix.join('tests/normal', source) })),
    ...spec.files.user_tests.map((source) => Object.freeze({ role: 'user_test', source, target: path.posix.join('tests/user', source) }))
  ]);
}

export async function assessRepositoryAssetCandidate({ repoPath, revision, assetRoot = '', spec } = {}) {
  const requestedRevision = exactCommit(revision, 'revision');
  const intake = await inspectRepositoryChanges({ repoPath, currentRevision: requestedRevision });
  const root = assetRoot ? safeRelative(assetRoot, 'assetRoot') : '';
  const normalized = validateSpec(spec, intake.current_revision);
  const mappings = mappedFiles(normalized);
  const present = [];
  const missing = [];

  for (const mapping of mappings) {
    const found = readRevisionFile(intake.repository, intake.current_revision, root, mapping.source);
    if (!found) {
      missing.push(Object.freeze({ role: mapping.role, source_path: revisionPath(root, mapping.source), required: true }));
      continue;
    }
    present.push(Object.freeze({ role: mapping.role, source_path: found.source_path, target_path: mapping.target, size: found.bytes.length }));
  }

  return Object.freeze({
    schema_version: RESULT_SCHEMA,
    status: missing.length ? 'INCOMPLETE' : 'READY_TO_MATERIALIZE',
    asset_id: normalized.declaration.id,
    repository: intake.repository,
    revision: intake.current_revision,
    asset_root: root || '.',
    declaration: normalized.declaration,
    mappings: Object.freeze(present),
    missing_requirements: Object.freeze(missing),
    admission: Object.freeze({
      catalog_registered: false,
      manifest_created: false,
      validation_complete: false
    }),
    mutation: Object.freeze({ source_repository: false, catalog: false })
  });
}

function assertOutsideCatalog(catalogRoot, outputDir) {
  const root = path.resolve(catalogRoot);
  const output = path.resolve(outputDir);
  if (output === root || output.startsWith(root + path.sep)) {
    throw new CatalogError('Candidate output must be outside the ModuleCatalog working tree.', 'ASSET_CANDIDATE_OUTPUT_UNSAFE');
  }
}

async function writeExact(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}

export async function materializeRepositoryAssetCandidate(catalogRoot, input, outputDir) {
  assertOutsideCatalog(catalogRoot, outputDir);
  const assessment = await assessRepositoryAssetCandidate(input);
  if (assessment.status !== 'READY_TO_MATERIALIZE') {
    const error = new CatalogError(`Candidate ${assessment.asset_id} is incomplete.`, 'ASSET_CANDIDATE_INCOMPLETE');
    error.details = assessment;
    throw error;
  }

  const destination = path.resolve(outputDir);
  const existing = await fs.stat(destination).catch(() => null);
  if (existing) throw new CatalogError(`Candidate output already exists: ${destination}`, 'ASSET_CANDIDATE_OUTPUT_EXISTS');
  const parent = path.dirname(destination);
  await fs.mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`);

  try {
    await fs.mkdir(temporary, { recursive: false });
    await writeExact(path.join(temporary, 'meta.json'), Buffer.from(`${JSON.stringify(assessment.declaration, null, 2)}\n`, 'utf8'));
    for (const mapping of assessment.mappings) {
      const relativeToAssetRoot = assessment.asset_root === '.'
        ? mapping.source_path
        : mapping.source_path.slice(assessment.asset_root.length + 1);
      const found = readRevisionFile(assessment.repository, assessment.revision, assessment.asset_root === '.' ? '' : assessment.asset_root, relativeToAssetRoot);
      if (!found) throw new CatalogError(`Candidate source disappeared from exact revision: ${mapping.source_path}`, 'ASSET_CANDIDATE_FILE_UNAVAILABLE');
      await writeExact(path.join(temporary, mapping.target_path), found.bytes);
    }

    const validation = await validateAssetDirectory(temporary);
    if (validation.meta.id !== assessment.asset_id) {
      throw new CatalogError('Materialized candidate identity changed during validation.', 'ASSET_CANDIDATE_IDENTITY_MISMATCH');
    }
    await fs.rename(temporary, destination);
    return Object.freeze({
      ...assessment,
      status: 'READY_FOR_ADMISSION',
      output_directory: destination,
      admission: Object.freeze({
        catalog_registered: false,
        manifest_created: false,
        validation_complete: true
      })
    });
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
