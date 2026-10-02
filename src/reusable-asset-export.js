import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CatalogError, sha256, tokenize, validateAssetDirectory } from './catalog.js';
import { assertReusableAssetSchema, createReusableAssetValidator } from './reusable-asset-schema.js';

const CATALOG_REPOSITORY = 'seigo-gace/modular-catalog';
const BUNDLE_FORMAT = 'gace.reusable-asset.v1';
const SECTION_FILES = ['README.md', 'design.md', 'logic.md', 'architecture.md', 'evidence.json', 'manifest.json'];

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

async function exists(target) { try { await fs.access(target); return true; } catch { return false; } }

function getCatalogCommit(rootDir, explicitCommit) {
  if (explicitCommit) return explicitCommit;
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim(); }
  catch { throw new CatalogError('Catalog commit could not be resolved. Pass --catalog-commit or run inside a Git checkout.', 'MISSING_CATALOG_COMMIT'); }
}

function classifyAsset(meta) {
  if (meta.assetKind) return { value: meta.assetKind, mode: 'canonical', source: 'meta.assetKind' };
  if (meta.tags.includes('skill')) return { value: 'capability', mode: 'deterministic-derived', source: 'meta.tags contains skill' };
  return { value: 'unknown', mode: 'not-recorded', source: 'no explicit asset kind or skill tag' };
}

function mutationAuthority(meta) {
  if (meta.constraints.some((value) => /no (direct )?mutation authority/i.test(value))) return false;
  return null;
}

function makeOverview(meta) {
  return [
    'Name: ' + meta.name,
    'Version: ' + meta.version,
    'Summary: ' + meta.summary,
    'Purpose: ' + meta.purpose,
    'Responsibility: ' + meta.responsibility,
    'Layers: ' + meta.layers.join(', '),
    'Languages: ' + meta.languages.join(', '),
    'Runtimes: ' + meta.runtimes.join(', '),
    'Tags: ' + meta.tags.join(', '),
    'Dependencies: ' + (meta.dependencies.length ? meta.dependencies.join(', ') : 'NOT_RECORDED'),
    'Constraints: ' + (meta.constraints.length ? meta.constraints.join('; ') : 'NOT_RECORDED')
  ].join('\n');
}

function makeKnowledgeUnit({ knowledgeId, parentAssetId, kind, title, content, sourcePaths, derived = false }) {
  return {
    schema_version: 1,
    knowledge_id: knowledgeId,
    parent_asset_id: parentAssetId,
    knowledge_kind: kind,
    title,
    content,
    source_paths: sourcePaths,
    content_status: content ? 'recorded' : 'not_recorded',
    derivation: { type: derived ? 'deterministic-derived' : 'canonical-projection', derived_from: sourcePaths, verified: !derived }
  };
}

async function collectFiles(directory, prefix) {
  const result = {};
  if (!await exists(directory)) return result;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new CatalogError('Symbolic link is not allowed: ' + relative, 'SYMLINK_REJECTED');
    if (entry.isDirectory()) Object.assign(result, await collectFiles(full, relative));
    if (entry.isFile()) result[relative] = await fs.readFile(full, 'utf8');
  }
  return result;
}

async function collectSourceAndTests(assetDir) {
  return {
    source: await collectFiles(path.join(assetDir, 'source'), 'source'),
    tests: await collectFiles(path.join(assetDir, 'tests'), 'tests')
  };
}

function normalizeCase({ assetId, caseType, sourcePath, content, evidence }) {
  const evidenceItem = evidence[caseType];
  return {
    schema_version: 1,
    case_id: assetId + '::case::' + caseType + '::' + path.basename(sourcePath),
    parent_asset_id: assetId,
    case_type: caseType,
    scenario: null,
    input: null,
    expected: evidenceItem?.expectedResults ?? [],
    actual: null,
    result: evidenceItem?.passed === true ? 'PASS' : 'UNKNOWN',
    source_test: sourcePath,
    test_content: content,
    extraction_status: 'source-reference-only',
    derivation: { type: 'canonical-projection', derived_from: [sourcePath, 'evidence.json#/' + caseType], verified: evidenceItem?.passed === true }
  };
}

async function buildReusableAsset(rootDir, assetId, catalogCommit, allAssetIds) {
  const assetDir = path.join(rootDir, 'assets', assetId);
  const { meta, evidence, manifest } = await validateAssetDirectory(assetDir, { verifyManifest: true });
  const sections = {};
  for (const file of SECTION_FILES) sections[file] = await fs.readFile(path.join(assetDir, file), 'utf8');
  const { source, tests } = await collectSourceAndTests(assetDir);
  const classification = classifyAsset(meta);
  const keywords = tokenize([meta.id, meta.name, meta.summary, meta.purpose, meta.responsibility, ...meta.layers, ...meta.languages, ...meta.runtimes, ...meta.tags, ...meta.dependencies, ...meta.constraints, sections.design, sections.logic, sections.architecture].join(' '));
  const sourcePaths = Object.keys(source).sort();
  const testPaths = Object.keys(tests).sort();

  const knowledgeUnits = [
    makeKnowledgeUnit({ knowledgeId: assetId + '::overview', parentAssetId: assetId, kind: 'discovery', title: meta.name, content: makeOverview(meta), sourcePaths: ['meta.json'] }),
    makeKnowledgeUnit({ knowledgeId: assetId + '::readme', parentAssetId: assetId, kind: 'documentation', title: meta.name + ' README', content: sections['README.md'], sourcePaths: ['README.md'] }),
    makeKnowledgeUnit({ knowledgeId: assetId + '::design', parentAssetId: assetId, kind: 'design', title: meta.name + ' Design', content: sections['design.md'], sourcePaths: ['design.md'] }),
    makeKnowledgeUnit({ knowledgeId: assetId + '::logic', parentAssetId: assetId, kind: 'logic', title: meta.name + ' Logic', content: sections['logic.md'], sourcePaths: ['logic.md'] }),
    makeKnowledgeUnit({ knowledgeId: assetId + '::architecture', parentAssetId: assetId, kind: 'architecture', title: meta.name + ' Architecture', content: sections['architecture.md'], sourcePaths: ['architecture.md'] }),
    makeKnowledgeUnit({ knowledgeId: assetId + '::evidence', parentAssetId: assetId, kind: 'evidence', title: meta.name + ' Verification Evidence', content: sections['evidence.json'], sourcePaths: ['evidence.json'] }),
    ...sourcePaths.map((sourcePath) => makeKnowledgeUnit({ knowledgeId: assetId + '::code::' + sourcePath, parentAssetId: assetId, kind: 'code', title: meta.name + ' ' + sourcePath, content: source[sourcePath], sourcePaths: [sourcePath] })),
    ...testPaths.map((testPath) => makeKnowledgeUnit({ knowledgeId: assetId + '::test::' + testPath, parentAssetId: assetId, kind: 'test_case', title: meta.name + ' ' + testPath, content: tests[testPath], sourcePaths: [testPath] }))
  ];

  const cases = testPaths.map((testPath) => {
    const match = /^tests\/(normal|user)\//.exec(testPath);
    return normalizeCase({ assetId, caseType: match?.[1] ?? 'unknown', sourcePath: testPath, content: tests[testPath], evidence });
  });

  const relationships = knowledgeUnits.map((unit) => ({
    schema_version: 1,
    relationship_id: assetId + '::contains::' + unit.knowledge_id,
    from: assetId,
    relation: 'contains',
    to: unit.knowledge_id,
    verified: true,
    derivation: { type: 'canonical-projection', derived_from: unit.source_paths }
  }));
  for (const dependency of meta.dependencies) {
    if (!allAssetIds.has(dependency)) continue;
    relationships.push({ schema_version: 1, relationship_id: assetId + '::depends_on::' + dependency, from: assetId, relation: 'depends_on', to: dependency, verified: true, derivation: { type: 'canonical-projection', derived_from: ['meta.json#/dependencies'] } });
  }

  const asset = {
    schema_version: 1,
    identity: { asset_id: meta.id, name: meta.name, version: meta.version, asset_kind: classification.value, symbol: null },
    classification: { domains: [], layers: meta.layers, languages: meta.languages, runtimes: meta.runtimes, tags: meta.tags },
    discovery: { summary: meta.summary, purpose: meta.purpose, responsibility: meta.responsibility, capabilities: [], keywords, semantic_terms: [] },
    applicability: { use_when: [], do_not_use_when: [], preconditions: [], required_context: [], failure_conditions: [] },
    contract: { status: 'unknown', inputs: [], outputs: [], required_fields: [], optional_fields: [], error_behavior: null, side_effects: null, mutation_authority: mutationAuthority(meta) },
    composition: { depends_on: meta.dependencies, requires: [], recommended_before: [], recommended_after: [], complements: [], alternative_to: [], conflicts_with: [], supersedes: [] },
    implementation: { languages: meta.languages, runtimes: meta.runtimes, entrypoints: sourcePaths, source_files: sourcePaths, dependencies: meta.dependencies },
    verification: { status: evidence.normal.passed === true && evidence.user.passed === true ? 'verified' : 'unknown', normal_test: evidence.normal, user_test: evidence.user, verified_at: meta.verifiedAt, validation_boundary: 'Only the checks explicitly recorded in evidence.json are represented as verified.', known_unverified: [] },
    provenance: { origin: { repository: meta.source.repository, commit: meta.source.commit }, catalog: { repository: CATALOG_REPOSITORY, commit: catalogCommit, asset_path: 'assets/' + assetId, asset_id: assetId } },
    lifecycle: { status: 'verified', introduced_version: meta.version, deprecated_at: null, superseded_by: null },
    integrity: { asset_hash: manifest.assetHash, meta_hash: sha256(canonicalJson(meta)), manifest_algorithm: manifest.algorithm, files: manifest.files },
    derivation: {
      canonical_sources: ['meta.json', 'README.md', 'design.md', 'logic.md', 'architecture.md', 'evidence.json', 'manifest.json', 'source/', 'tests/'],
      derived_fields: [
        { field: 'identity.asset_kind', type: classification.mode, source: classification.source, verified: classification.mode === 'canonical' },
        { field: 'discovery.keywords', type: 'deterministic-derived', source: 'meta + design + logic + architecture', verified: false },
        { field: 'contract.mutation_authority', type: 'deterministic-derived', source: 'meta.constraints', verified: false }
      ]
    }
  };
  return { asset, knowledgeUnits, relationships, cases, sourceCount: sourcePaths.length, testCount: testPaths.length };
}

async function writeJson(file, value) { await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
async function writeJsonl(file, values) { await fs.writeFile(file, values.map((value) => JSON.stringify(value)).join('\n') + (values.length ? '\n' : ''), 'utf8'); }

async function writeBundleManifest(directory, assetId, catalogCommit, sourceAssetHash) {
  const files = [];
  for (const name of ['asset.json', 'knowledge-units.jsonl', 'relationships.jsonl', 'cases.jsonl']) {
    const file = path.join(directory, name);
    const content = await fs.readFile(file);
    files.push({ path: name, size: content.length, sha256: sha256(content) });
  }
  const bundleHash = sha256(canonicalJson(files));
  const manifest = { schema_version: 1, format: BUNDLE_FORMAT, asset_id: assetId, catalog: { repository: CATALOG_REPOSITORY, commit: catalogCommit, asset_path: 'assets/' + assetId }, source_asset_hash: sourceAssetHash, bundle_hash: bundleHash, algorithm: 'sha256', files };
  await writeJson(path.join(directory, 'manifest.json'), manifest);
  return manifest;
}

function assertOutsideRoot(rootDir, outputDir) {
  const root = path.resolve(rootDir);
  const output = path.resolve(outputDir);
  if (output === root || output.startsWith(root + path.sep)) throw new CatalogError('Export output must be outside the catalog root.', 'UNSAFE_OUTPUT');
}

export async function exportReusableAssets(rootDir, outputDir, { assetId = null, catalogCommit = null } = {}) {
  const root = path.resolve(rootDir);
  const output = path.resolve(outputDir);
  assertOutsideRoot(root, output);
  const commit = getCatalogCommit(root, catalogCommit);
  const schemaValidator = await createReusableAssetValidator(root);
  const assetsRoot = path.join(root, 'assets');
  if (!await exists(assetsRoot)) throw new CatalogError('assets/ directory is required.', 'MISSING_ASSETS');
  const allCatalogAssetIds = (await fs.readdir(assetsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort();
  let assetIds = [...allCatalogAssetIds];
  if (assetId) {
    if (!assetIds.includes(assetId)) throw new CatalogError('Unknown asset: ' + assetId, 'ASSET_NOT_FOUND');
    assetIds = [assetId];
  }
  if (!assetId) {
    const index = JSON.parse(await fs.readFile(path.join(root, 'catalog', 'index.json'), 'utf8'));
    if (index.assetCount !== assetIds.length || index.entries.length !== assetIds.length) throw new CatalogError('Catalog index cardinality does not match assets/.', 'CATALOG_CARDINALITY_MISMATCH');
  }
  const allAssetIds = new Set(allCatalogAssetIds);
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  const exported = [];
  for (const id of assetIds) {
    const built = await buildReusableAsset(root, id, commit, allAssetIds);
    assertReusableAssetSchema(schemaValidator, built.asset, id);
    const dir = path.join(output, 'assets', id);
    await fs.mkdir(dir, { recursive: true });
    await writeJson(path.join(dir, 'asset.json'), built.asset);
    await writeJsonl(path.join(dir, 'knowledge-units.jsonl'), built.knowledgeUnits);
    await writeJsonl(path.join(dir, 'relationships.jsonl'), built.relationships);
    await writeJsonl(path.join(dir, 'cases.jsonl'), built.cases);
    const manifest = await writeBundleManifest(dir, id, commit, built.asset.integrity.asset_hash);
    exported.push({ id, assetHash: built.asset.integrity.asset_hash, bundleHash: manifest.bundle_hash, knowledgeUnits: built.knowledgeUnits.length, relationships: built.relationships.length, cases: built.cases.length });
  }
  const topLevel = { schema_version: 1, format: BUNDLE_FORMAT, catalog: { repository: CATALOG_REPOSITORY, commit }, assetCount: exported.length, assets: exported };
  await writeJson(path.join(output, 'manifest.json'), topLevel);
  return topLevel;
}
