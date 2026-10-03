import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const LAYERS = new Set(['Part', 'Feature', 'Component', 'System', 'Application System']);
const REQUIRED_DOCS = ['design.md', 'logic.md', 'architecture.md', 'evidence.json'];
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*['\"][^'\"]{8,}['\"]/i
];

export class CatalogError extends Error {
  constructor(message, code = 'CATALOG_ERROR') {
    super(message);
    this.name = 'CatalogError';
    this.code = code;
  }
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\-]+/gu, ' ')
    .trim();
}

export function tokenize(value) {
  return [...new Set(normalizeText(value).split(/\s+/).filter(Boolean))];
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = path.posix.join(relative.split(path.sep).join('/'), entry.name);
    const full = path.join(root, rel);
    if (entry.isSymbolicLink()) throw new CatalogError(`Symbolic link is not allowed: ${rel}`, 'SYMLINK_REJECTED');
    if (entry.isDirectory()) files.push(...await listFiles(root, rel));
    if (entry.isFile()) files.push(rel);
  }
  return files;
}

function assertSafeId(id) {
  if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(id)) {
    throw new CatalogError('meta.id must be 3-80 characters using lowercase letters, numbers, and hyphens.', 'INVALID_ID');
  }
}

function assertString(meta, field) {
  if (typeof meta[field] !== 'string' || !meta[field].trim()) {
    throw new CatalogError(`meta.${field} is required.`, 'INVALID_META');
  }
}

function assertStringArray(meta, field, allowEmpty = false) {
  if (!Array.isArray(meta[field]) || (!allowEmpty && meta[field].length === 0) || meta[field].some((item) => typeof item !== 'string' || !item.trim())) {
    throw new CatalogError(`meta.${field} must be ${allowEmpty ? 'a' : 'a non-empty'} string array.`, 'INVALID_META');
  }
}

function explicitReusableAssetTypes(meta) {
  if (meta.reusableAssetTypes == null) return null;
  if (!Array.isArray(meta.reusableAssetTypes) || meta.reusableAssetTypes.length === 0 || meta.reusableAssetTypes.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new CatalogError('meta.reusableAssetTypes must be a non-empty string array when provided.', 'INVALID_META');
  }
  return [...new Set(meta.reusableAssetTypes.map((item) => item.trim()))];
}

function isExplicitNonCodeAsset(meta) {
  const types = explicitReusableAssetTypes(meta);
  return Array.isArray(types) && !types.includes('code');
}

function reusableAssetTypesForSearch(meta) {
  const explicit = explicitReusableAssetTypes(meta);
  if (explicit) return explicit;
  const derived = [];
  if (typeof meta.assetKind === 'string' && meta.assetKind.trim()) derived.push(meta.assetKind.trim());
  if (Array.isArray(meta.tags) && meta.tags.includes('skill')) derived.push('capability', 'skill');
  derived.push('code', 'design', 'logic', 'architecture', 'test');
  return [...new Set(derived)];
}

export function validateMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new CatalogError('meta.json must contain an object.', 'INVALID_META');
  if (meta.schemaVersion !== 1) throw new CatalogError('meta.schemaVersion must be 1.', 'INVALID_META');
  assertSafeId(meta.id);
  for (const field of ['name', 'version', 'summary', 'purpose', 'responsibility']) assertString(meta, field);
  const nonCode = isExplicitNonCodeAsset(meta);
  assertStringArray(meta, 'layers', nonCode);
  assertStringArray(meta, 'languages', nonCode);
  assertStringArray(meta, 'runtimes', nonCode);
  assertStringArray(meta, 'tags');
  for (const field of ['dependencies', 'constraints']) assertStringArray(meta, field, true);
  if (meta.assetKind != null && (typeof meta.assetKind !== 'string' || !meta.assetKind.trim())) throw new CatalogError('meta.assetKind must be a non-empty string when provided.', 'INVALID_META');
  if (meta.layers.some((layer) => !LAYERS.has(layer))) throw new CatalogError('meta.layers contains an invalid five-layer value.', 'INVALID_META');
  if (meta.fiveV != null && (!meta.fiveV || typeof meta.fiveV !== 'object' || Array.isArray(meta.fiveV))) throw new CatalogError('meta.fiveV must be an object when provided.', 'INVALID_META');
  if (!meta.source || typeof meta.source.repository !== 'string' || !meta.source.repository.trim() || typeof meta.source.commit !== 'string' || !meta.source.commit.trim()) {
    throw new CatalogError('meta.source.repository and meta.source.commit are required.', 'INVALID_META');
  }
  if (Number.isNaN(Date.parse(meta.verifiedAt))) throw new CatalogError('meta.verifiedAt must be ISO 8601.', 'INVALID_META');
  return meta;
}

function validateEvidence(evidence) {
  for (const kind of ['normal', 'user']) {
    const item = evidence?.[kind];
    if (!item || item.passed !== true) throw new CatalogError(`evidence.${kind}.passed must be true.`, 'UNVERIFIED_ASSET');
    if (!Array.isArray(item.commands) || item.commands.length === 0 || item.commands.some((value) => typeof value !== 'string' || !value.trim())) {
      throw new CatalogError(`evidence.${kind}.commands must record executed checks.`, 'INVALID_EVIDENCE');
    }
    if (!Array.isArray(item.expectedResults) || item.expectedResults.length === 0 || item.expectedResults.some((value) => typeof value !== 'string' || !value.trim())) {
      throw new CatalogError(`evidence.${kind}.expectedResults must record verified outcomes.`, 'INVALID_EVIDENCE');
    }
  }
  return evidence;
}

async function readJson(file) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new CatalogError(`Invalid JSON: ${file}: ${error.message}`, 'INVALID_JSON');
  }
  return parsed;
}

async function scanSecrets(assetDir, files) {
  for (const relative of files) {
    if (relative === 'manifest.json') continue;
    const full = path.join(assetDir, relative);
    const stat = await fs.stat(full);
    if (stat.size > 2 * 1024 * 1024) throw new CatalogError(`File exceeds 2 MiB limit: ${relative}`, 'FILE_TOO_LARGE');
    const content = await fs.readFile(full);
    if (content.includes(0)) continue;
    const text = content.toString('utf8');
    if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
      throw new CatalogError(`Possible secret detected: ${relative}`, 'SECRET_DETECTED');
    }
  }
}

export async function createManifest(assetDir) {
  const files = (await listFiles(assetDir)).filter((relative) => relative !== 'manifest.json');
  const records = [];
  for (const relative of files) {
    const content = await fs.readFile(path.join(assetDir, relative));
    records.push({ path: relative, size: content.length, sha256: sha256(content) });
  }
  const assetHash = sha256(canonicalJson(records));
  return { schemaVersion: 1, algorithm: 'sha256', assetHash, files: records };
}

export async function validateAssetDirectory(assetDir, { verifyManifest = false } = {}) {
  const absolute = path.resolve(assetDir);
  const metaPath = path.join(absolute, 'meta.json');
  if (!await exists(metaPath)) throw new CatalogError('meta.json is required.', 'MISSING_FILE');
  const meta = validateMeta(await readJson(metaPath));

  for (const file of REQUIRED_DOCS) {
    const target = path.join(absolute, file);
    if (!await exists(target) || (await fs.stat(target)).size === 0) throw new CatalogError(`${file} is required and must not be empty.`, 'MISSING_FILE');
  }
  const nonCode = isExplicitNonCodeAsset(meta);
  const sourcePath = await exists(path.join(absolute, 'source')) ? path.join(absolute, 'source') : (await exists(path.join(absolute, 'code')) ? path.join(absolute, 'code') : null);
  if (!nonCode) {
    if (!sourcePath || !(await fs.stat(sourcePath)).isDirectory()) throw new CatalogError('source/ or code/ is required.', 'MISSING_DIRECTORY');
    const sourceFiles = await listFiles(sourcePath);
    if (sourceFiles.length === 0) throw new CatalogError('source/ or code/ must contain files.', 'EMPTY_DIRECTORY');
  } else if (sourcePath) {
    if (!(await fs.stat(sourcePath)).isDirectory()) throw new CatalogError('source/ or code/ must be a directory when present.', 'MISSING_DIRECTORY');
    const sourceFiles = await listFiles(sourcePath);
    if (sourceFiles.length === 0) throw new CatalogError('source/ or code/ must contain files when present.', 'EMPTY_DIRECTORY');
  }
  for (const directory of ['tests/normal', 'tests/user']) {
    const target = path.join(absolute, directory);
    if (!await exists(target) || !(await fs.stat(target)).isDirectory()) throw new CatalogError(`${directory}/ is required.`, 'MISSING_DIRECTORY');
    const files = await listFiles(target);
    if (files.length === 0) throw new CatalogError(`${directory}/ must contain files.`, 'EMPTY_DIRECTORY');
  }

  const evidence = validateEvidence(await readJson(path.join(absolute, 'evidence.json')));
  const files = await listFiles(absolute);
  await scanSecrets(absolute, files);
  const manifest = await createManifest(absolute);

  if (verifyManifest) {
    const manifestPath = path.join(absolute, 'manifest.json');
    if (!await exists(manifestPath)) throw new CatalogError('manifest.json is required for a registered asset.', 'MISSING_MANIFEST');
    const stored = await readJson(manifestPath);
    if (stored.algorithm !== 'sha256' || stored.assetHash !== manifest.assetHash || canonicalJson(stored.files) !== canonicalJson(manifest.files)) {
      throw new CatalogError(`Integrity mismatch for asset ${meta.id}.`, 'INTEGRITY_MISMATCH');
    }
  }

  return { meta, evidence, manifest };
}

function compactEntry(meta, manifest, documents = {}) {
  const searchText = [
    meta.id, meta.name, meta.summary, meta.purpose, meta.responsibility,
    ...meta.layers, ...meta.languages, ...meta.runtimes, ...meta.tags,
    ...meta.dependencies, ...meta.constraints,
    ...Object.values(documents)
  ].join(' ');
  return {
    id: meta.id,
    name: meta.name,
    version: meta.version,
    summary: meta.summary,
    responsibility: meta.responsibility,
    layers: meta.layers,
    languages: meta.languages,
    runtimes: meta.runtimes,
    tags: meta.tags,
    dependencies: meta.dependencies,
    constraints: meta.constraints,
    source: meta.source,
    verifiedAt: meta.verifiedAt,
    metaHash: sha256(canonicalJson(meta)),
    assetHash: manifest.assetHash,
    tokens: tokenize(searchText),
    documentTokens: Object.fromEntries(Object.entries(documents).map(([section, content]) => [section, tokenize(content)]))
  };
}

export async function buildIndex(rootDir) {
  const root = path.resolve(rootDir);
  const assetsDir = path.join(root, 'assets');
  const entries = [];
  if (await exists(assetsDir)) {
    const children = await fs.readdir(assetsDir, { withFileTypes: true });
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!child.isDirectory() || child.name.startsWith('.')) continue;
      const assetDir = path.join(assetsDir, child.name);
      const result = await validateAssetDirectory(assetDir, { verifyManifest: true });
      if (result.meta.id !== child.name) throw new CatalogError(`Asset directory name must equal meta.id: ${child.name}`, 'ID_PATH_MISMATCH');
      const documents = {};
      for (const section of ['design', 'logic', 'architecture']) {
        documents[section] = await fs.readFile(path.join(assetDir, `${section}.md`), 'utf8');
      }
      entries.push(compactEntry(result.meta, result.manifest, documents));
    }
  }
  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    assetCount: entries.length,
    entries
  };
  const catalogDir = path.join(root, 'catalog');
  await fs.mkdir(catalogDir, { recursive: true });
  const indexPath = path.join(catalogDir, 'index.json');
  const temporaryPath = path.join(catalogDir, `.index.${process.pid}.${Date.now()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, indexPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
  return index;
}

function includesNormalized(values, filter) {
  if (!filter) return true;
  const wanted = normalizeText(filter);
  return values.some((value) => normalizeText(value) === wanted || normalizeText(value).includes(wanted));
}

function scoreEntry(entry, queryTokens, queryText) {
  const id = normalizeText(entry.id);
  const name = normalizeText(entry.name);
  const summary = normalizeText(entry.summary);
  const responsibility = normalizeText(entry.responsibility);
  let score = 0;
  if (id === queryText || name === queryText) score += 160;
  if (entry.assetHash === queryText || entry.metaHash === queryText) score += 200;
  if (id.includes(queryText) || name.includes(queryText)) score += 70;
  for (const token of queryTokens) {
    if (id === token || name.split(' ').includes(token)) score += 45;
    if (entry.tags.some((tag) => normalizeText(tag) === token)) score += 35;
    if (entry.tokens.includes(token)) score += 12;
    if (responsibility.includes(token)) score += 18;
    if (summary.includes(token)) score += 8;
    for (const sectionTokens of Object.values(entry.documentTokens || {})) {
      if (sectionTokens.some((value) => value === token || value.includes(token))) score += 16;
    }
  }
  return score;
}

export async function searchCatalog(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const index = await readJson(path.join(root, 'catalog', 'index.json'));
  if (index.schemaVersion !== 1 || !Array.isArray(index.entries)) throw new CatalogError('catalog/index.json has an unsupported format.', 'INVALID_INDEX');

  const queryText = normalizeText(options.query ?? '');
  const queryTokens = tokenize(queryText);
  const limit = Math.max(1, Math.min(Number(options.limit ?? 5), 50));
  const profileFilter = Boolean(options.assetType || options.fiveVLevel);
  const defaultPool = profileFilter ? index.entries.length : limit * 3;
  const poolLimit = Math.max(limit, Math.min(Number(options.pool ?? defaultPool), Math.max(100, index.entries.length)));

  const stageOne = index.entries
    .filter((entry) => includesNormalized(entry.languages, options.language))
    .filter((entry) => includesNormalized(entry.runtimes, options.runtime))
    .filter((entry) => includesNormalized(entry.layers, options.layer))
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens, queryText) }))
    .filter(({ score }) => queryTokens.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, poolLimit);

  const refined = [];
  for (const candidate of stageOne) {
    const metaPath = path.join(root, 'assets', candidate.entry.id, 'meta.json');
    if (!await exists(metaPath)) continue;
    const meta = validateMeta(await readJson(metaPath));
    const assetTypes = reusableAssetTypesForSearch(meta);
    const fiveVLevel = meta.fiveV?.applicable === true && typeof meta.fiveV.level === 'string' ? meta.fiveV.level : null;
    if (options.assetType && !includesNormalized(assetTypes, options.assetType)) continue;
    if (options.fiveVLevel && !includesNormalized(fiveVLevel ? [fiveVLevel] : [], options.fiveVLevel)) continue;
    let score = candidate.score;
    if (options.dependency && includesNormalized(meta.dependencies, options.dependency)) score += 25;
    if (options.tag && includesNormalized(meta.tags, options.tag)) score += 25;
    if (options.constraint && includesNormalized(meta.constraints, options.constraint)) score += 10;
    refined.push({
      id: meta.id,
      name: meta.name,
      version: meta.version,
      summary: meta.summary,
      responsibility: meta.responsibility,
      assetKind: meta.assetKind ?? null,
      reusableAssetTypes: assetTypes,
      fiveV: meta.fiveV ?? null,
      layers: meta.layers,
      languages: meta.languages,
      runtimes: meta.runtimes,
      tags: meta.tags,
      dependencies: meta.dependencies,
      constraints: meta.constraints,
      source: meta.source,
      verifiedAt: meta.verifiedAt,
      assetHash: candidate.entry.assetHash,
      matchedSections: Object.entries(candidate.entry.documentTokens || {})
        .filter(([, tokens]) => queryTokens.some((token) => tokens.some((value) => value === token || value.includes(token))))
        .map(([section]) => section),
      score
    });
  }
  return refined.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new CatalogError(`Symbolic link is not allowed: ${from}`, 'SYMLINK_REJECTED');
    if (entry.isDirectory()) await copyDirectory(from, to);
    if (entry.isFile()) await fs.copyFile(from, to);
  }
}

export async function registerAsset(rootDir, candidateDir) {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidateDir);
  const { meta } = await validateAssetDirectory(candidate);
  const assetsDir = path.join(root, 'assets');
  const destination = path.join(assetsDir, meta.id);
  if (await exists(destination)) throw new CatalogError(`Asset already exists: ${meta.id}`, 'ASSET_EXISTS');
  await fs.mkdir(assetsDir, { recursive: true });
  const temporary = path.join(assetsDir, `.${meta.id}.${process.pid}.${Date.now()}`);
  let moved = false;
  try {
    await copyDirectory(candidate, temporary);
    const manifest = await createManifest(temporary);
    await fs.writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, destination);
    moved = true;
    await buildIndex(root);
    return { id: meta.id, destination, assetHash: manifest.assetHash };
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    if (moved) {
      await fs.rm(destination, { recursive: true, force: true });
      await buildIndex(root).catch(() => undefined);
    }
    throw error;
  }
}

export async function verifyIndex(rootDir) {
  const root = path.resolve(rootDir);
  const stored = await readJson(path.join(root, 'catalog', 'index.json'));
  const tempRoot = await fs.mkdtemp(path.join(root, '.index-verify-'));
  try {
    if (await exists(path.join(root, 'assets'))) await copyDirectory(path.join(root, 'assets'), path.join(tempRoot, 'assets'));
    const generated = await buildIndex(tempRoot);
    const project = (index) => ({ schemaVersion: index.schemaVersion, assetCount: index.assetCount, entries: index.entries });
    if (canonicalJson(project(stored)) !== canonicalJson(project(generated))) {
      throw new CatalogError('catalog/index.json is stale or inconsistent.', 'STALE_INDEX');
    }
    return { assetCount: stored.assetCount };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function loadAssetSection(rootDir, assetId, section = 'meta') {
  assertSafeId(assetId);
  const root = path.resolve(rootDir);
  const assetDir = path.join(root, 'assets', assetId);
  if (!await exists(assetDir)) throw new CatalogError(`Unknown asset: ${assetId}`, 'ASSET_NOT_FOUND');
  const sourceTarget = await exists(path.join(assetDir, 'source')) ? 'source' : (await exists(path.join(assetDir, 'code')) ? 'code' : null);
  const map = {
    meta: ['meta.json'],
    design: ['design.md'],
    logic: ['logic.md'],
    architecture: ['architecture.md'],
    evidence: ['evidence.json'],
    manifest: ['manifest.json'],
    tests: ['tests'],
    code: sourceTarget ? [sourceTarget] : [],
    source: sourceTarget ? [sourceTarget] : [],
    all: ['meta.json', 'design.md', 'logic.md', 'architecture.md', 'evidence.json', 'manifest.json', ...(sourceTarget ? [sourceTarget] : []), 'tests']
  };
  const targets = map[section];
  if (!targets) throw new CatalogError(`Unknown section: ${section}`, 'INVALID_SECTION');
  const output = {};
  for (const target of targets) {
    const full = path.join(assetDir, target);
    if (!(full === assetDir || full.startsWith(`${assetDir}${path.sep}`))) throw new CatalogError('Unsafe path.', 'UNSAFE_PATH');
    const stat = await fs.stat(full);
    if (stat.isFile()) output[target] = await fs.readFile(full, 'utf8');
    if (stat.isDirectory()) {
      for (const relative of await listFiles(full)) {
        output[path.posix.join(target, relative)] = await fs.readFile(path.join(full, relative), 'utf8');
      }
    }
  }
  return output;
}
