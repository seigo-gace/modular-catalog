import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CatalogError, sha256, tokenize, validateAssetDirectory } from './catalog.js';
import { assertReusableAssetSchema, createReusableAssetValidator } from './reusable-asset-schema.js';
import { analyzeSourceFiles } from './structural-analyzer.js';

const CATALOG_REPOSITORY = 'seigo-gace/modular-catalog';
const BUNDLE_FORMAT = 'gace.reusable-asset.v1';
const SECTION_FILES = ['README.md', 'design.md', 'logic.md', 'architecture.md', 'evidence.json', 'manifest.json'];
const GENERIC_EXPORT_NAMES = new Set(['run', 'main', 'execute', 'handler', 'default']);

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

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))].sort((a, b) => a.localeCompare(b));
}

function structuralProjection(analyses) {
  const facts = [];
  const knownUnverified = [];
  for (const result of analyses) {
    if (result.status === 'PARSE_ERROR') {
      knownUnverified.push(`STRUCTURAL_PARSE_ERROR:${result.source_path}`);
      continue;
    }
    if (result.status !== 'ANALYZED') continue;
    for (const fact of result.facts) facts.push({ ...fact, source_path: result.source_path });
  }

  const exportedNames = uniqueSorted(facts.filter((fact) => fact.kind === 'export').map((fact) => fact.name));
  const functionFacts = facts.filter((fact) => fact.kind === 'function' && fact.name);
  const functionByName = new Map();
  for (const fact of functionFacts) {
    if (!functionByName.has(fact.name)) functionByName.set(fact.name, fact);
  }

  const contractInputs = [];
  const contractOutputs = [];
  for (const name of exportedNames) {
    const fn = functionByName.get(name);
    if (!fn) continue;
    if (fn.parameters) contractInputs.push(`${name}${fn.parameters}`);
    for (const expression of Array.isArray(fn.returns) ? fn.returns : []) contractOutputs.push(`${name} -> ${expression}`);
  }

  const requires = uniqueSorted(facts.filter((fact) => fact.kind === 'import' || fact.kind === 'require').map((fact) => fact.source));
  const semanticTerms = uniqueSorted(tokenize([
    ...exportedNames,
    ...functionFacts.map((fact) => fact.parameters ?? ''),
    ...requires
  ].join(' ')).filter((term) => !GENERIC_EXPORT_NAMES.has(String(term).toLowerCase())));
  const capabilities = exportedNames.filter((name) => !GENERIC_EXPORT_NAMES.has(name.toLowerCase())).map((name) => `export:${name}`);

  return Object.freeze({
    primarySymbol: exportedNames.length === 1 ? exportedNames[0] : null,
    exportedNames,
    capabilities,
    semanticTerms,
    contractInputs: uniqueSorted(contractInputs),
    contractOutputs: uniqueSorted(contractOutputs),
    requires,
    knownUnverified: uniqueSorted(knownUnverified),
    analyzedSourcePaths: analyses.filter((item) => item.status === 'ANALYZED').map((item) => item.source_path).sort()
  });
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
  const analyses = await analyzeSourceFiles(sourcePaths.map((sourcePath) => ({ sourcePath, content: source[sourcePath] })));
  const structure = structuralProjection(analyses);

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

  const derivedFields = [
    { field: 'identity.asset_kind', type: classification.mode, source: classification.source, verified: classification.mode === 'canonical' },
    { field: 'discovery.keywords', type: 'deterministic-derived', source: 'meta + design + logic + architecture', verified: false },
    { field: 'contract.mutation_authority', type: 'deterministic-derived', source: 'meta.constraints', verified: false }
  ];
  if (structure.primarySymbol) derivedFields.push({ field: 'identity.symbol', type: 'deterministic-derived', source: 'ast-grep exact export set from source/', verified: false });
  if (structure.capabilities.length) derivedFields.push({ field: 'discovery.capabilities', type: 'deterministic-derived', source: 'ast-grep named exported symbols', verified: false });
  if (structure.semanticTerms.length) derivedFields.push({ field: 'discovery.semantic_terms', type: 'deterministic-derived', source: 'ast-grep exported symbols + function parameters + imports/requires', verified: false });
  if (structure.contractInputs.length) derivedFields.push({ field: 'contract.inputs', type: 'deterministic-derived', source: 'ast-grep exported function signatures', verified: false });
  if (structure.contractOutputs.length) derivedFields.push({ field: 'contract.outputs', type: 'deterministic-derived', source: 'ast-grep exact return expressions of exported functions', verified: false });
  if (structure.requires.length) derivedFields.push({ field: 'composition.requires', type: 'deterministic-derived', source: 'ast-grep exact import/require sources', verified: false });

  const asset = {
    schema_version: 1,
    identity: { asset_id: meta.id, name: meta.name, version: meta.version, asset_kind: classification.value, symbol: structure.primarySymbol },
    classification: { domains: [], layers: meta.layers, languages: meta.languages, runtimes: meta.runtimes, tags: meta.tags },
    discovery: { summary: meta.summary, purpose: meta.purpose, responsibility: meta.responsibility, capabilities: structure.capabilities, keywords, semantic_terms: structure.semanticTerms },
    applicability: { use_when: [], do_not_use_when: [], preconditions: [], required_context: [], failure_conditions: [] },
    contract: { status: 'unknown', inputs: structure.contractInputs, outputs: structure.contractOutputs, required_fields: [], optional_fields: [], error_behavior: null, side_effects: null, mutation_authority: mutationAuthority(meta) },
    composition: { depends_on: meta.dependencies, requires: structure.requires, recommended_before: [], recommended_after: [], complements: [], alternative_to: [], conflicts_with: [], supersedes: [] },
    implementation: { languages: meta.languages, runtimes: meta.runtimes, entrypoints: sourcePaths, source_files: sourcePaths, dependencies: meta.dependencies },
    verification: { status: evidence.normal.passed === true && evidence.user.passed === true ? 'verified' : 'unknown', normal_test: evidence.normal, user_test: evidence.user, verified_at: meta.verifiedAt, validation_boundary: 'Only the checks explicitly recorded in evidence.json are represented as verified.', known_unverified: structure.knownUnverified },
    provenance: { origin: { repository: meta.source.repository, commit: meta.source.commit }, catalog: { repository: CATALOG_REPOSITORY, commit: catalogCommit, asset_path: 'assets/' + assetId, asset_id: assetId } },
    lifecycle: { status: 'verified', introduced_version: meta.version, deprecated_at: null, superseded_by: null },
    integrity: { asset_hash: manifest.assetHash, meta_hash: sha256(canonicalJson(meta)), manifest_algorithm: manifest.algorithm, files: manifest.files },
    derivation: {
      canonical_sources: ['meta.json', 'README.md', 'design.md', 'logic.md', 'architecture.md', 'evidence.json', 'manifest.json', 'source/', 'tests/'],
      derived_fields: derivedFields
    }
  };
  return { asset, knowledgeUnits, relationships, cases, sourceCount: sourcePaths.length, testCount: testPaths.length, structuralAnalysis: analyses };
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
