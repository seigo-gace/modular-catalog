# ModuleCatalog

ModuleCatalog is the canonical repository and processing factory for reusable development assets.

It keeps verified Source / Design / Logic / Architecture / Contract / Test / Evidence / Provenance together, converts them into reusable Knowledge Units and related metadata, and delivers KB-ready data without fabricating missing facts.

## Current design authority

- Factory v1: [`docs/REUSABLE_KNOWLEDGE_FACTORY_V1.md`](docs/REUSABLE_KNOWLEDGE_FACTORY_V1.md)
- Repository Candidate: [`docs/REPOSITORY_ASSET_CANDIDATE_V1.md`](docs/REPOSITORY_ASSET_CANDIDATE_V1.md)
- KB delivery / ACTIVE readback contract: [`docs/KB_DELIVERY_CONTRACT_V1.md`](docs/KB_DELIVERY_CONTRACT_V1.md)
- Factory design delta: [`docs/DESIGN_DELTA_FACTORY_V1.md`](docs/DESIGN_DELTA_FACTORY_V1.md)
- Previous Catalog architecture baseline: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Asset format: [`docs/ASSET_FORMAT.md`](docs/ASSET_FORMAT.md)
- Reusable-data audit: [`docs/REUSABLE_ASSET_DATA_AUDIT_20261001.md`](docs/REUSABLE_ASSET_DATA_AUDIT_20261001.md)

The Factory v1 design is the current implementation baseline on the factory feature branch. GitHub source completion, candidate materialization, Catalog registration, Server runtime, KB delivery, KB `ACCEPTED`, and KB `ACTIVE` are separate states and must not be conflated.

## Fixed boundaries

Factory evidence inputs are kept separate:

```text
pinned Git repository / exact revision
+
TGserver logs through TGserver HTTP API
```

Implemented optional adapters use established boundaries only:

```text
AI Core Router API -> Granite Debug Controller -> SKIP / ANALYZE / VERIFY
DebugAI MCP        -> analyze / verify only
Astera QCE API     -> POST /v1/evaluate with X-API-Key
```

Direct Astera Evidence Search is **not currently connected from ModuleCatalog**. The current Evidence Search transport is an Astera-internal route that authenticates the caller as `service=astera-main`; there is no sanctioned ModuleCatalog caller identity in that contract. ModuleCatalog therefore reports `ASTERA_EVIDENCE_CONTRACT_NOT_AVAILABLE` instead of impersonating `astera-main` or guessing another route.

ModuleCatalog does not modify AI Core, DebugAI, Astera v8, TGserver, source repositories, or the KB runtime.

Factory responsibility covers exact-revision repository intake, non-fabricated candidate construction, deterministic extraction, reusable bundle generation, producer-side delivery validation, atomic transport through the agreed KB inbox boundary, and producer-side verification of the matching KB `ACTIVE` receipt/current authority. KB-side BM25 / Vector / Knowledge Graph / MCP/search runtime and continuing health checks remain outside ModuleCatalog.

## Current implemented Factory path

Repository intake resolves the supplied 40-character revision against the actual Git object database before optional external adapters can run. An optional exact `previous_revision` yields an incremental `git diff`; without it, intake reports a full snapshot; equal revisions return `UNCHANGED`. Changes under existing `assets/<asset-id>/...` paths are projected to affected Catalog Asset IDs, while non-Asset paths remain explicit as `unmapped_paths` instead of being silently discarded.

For a generic repository that is not already laid out as a Catalog Asset, ModuleCatalog now supports a separate non-registered Candidate boundary:

```text
exact external repo revision
  + explicit Canonical declaration
  + explicit Design / Logic / Architecture / Evidence / Source / Normal Test / User Test mapping
  -> assess missing repository facts
  -> READY_TO_MATERIALIZE or INCOMPLETE
  -> exact Git Blob materialization outside ModuleCatalog
  -> existing Asset validation
  -> READY_FOR_ADMISSION
  -> explicit existing `register` command only
```

The declaration and role mapping are explicit authority inputs. ModuleCatalog does not infer a missing purpose, responsibility, layer, language, runtime, verification result, User Test role, or Evidence record from arbitrary repository content. Materialization reads exact committed blobs, so uncommitted Working Tree changes cannot leak into the Candidate. `READY_FOR_ADMISSION` is still not `REGISTERED`.

The registered-Asset-to-KB path remains:

```text
Catalog Asset / source
  -> exact Git revision intake / optional incremental diff
  -> integrity + existing evidence validation
  -> ast-grep deterministic JS/TS structural extraction
  -> exact source-derived symbol / signature / return / import-require projection
  -> Reusable Asset Schema v1 (Ajv Draft 2020-12)
  -> deterministic bundle + hash/count preflight
  -> target-local temporary copy
  -> atomic ready/<catalog-commit> publish
  -> KB ACCEPTED / ACTIVE / Current readback
```

Exporter provenance is fail-closed: an explicit `--catalog-commit` must equal the checked-out Catalog `HEAD`. A caller cannot label current Working Tree content with another revision.

`README.md` is optional under the existing Asset admission format. The exporter emits a README Knowledge Unit only when the registered Asset actually contains a non-empty README; it never fabricates one.

The diagnostic/verification coordination path is separately bounded:

```text
exact repo + revision + optional TGserver observations
  -> repository revision resolution before external calls
  -> explicit/deterministic failure signals
  -> Granite Debug Controller when a signal exists
  -> DebugAI MCP analyze/verify when selected
  -> optional Astera QCE evaluation when an explicit QCE request is supplied
  -> INSPECTION_COMPLETE
```

`INSPECTION_COMPLETE`, `READY_FOR_ADMISSION`, Catalog registration, and KB `COMPLETE` are distinct states.

## Five-level Module Architecture

```text
Part
  -> Feature
    -> Component
      -> System
        -> Application System
```

This is a logical architecture. It does not require one directory per level.

## Reusable Asset Schema v1

Current reusable asset output is defined by:

```text
schemas/reusable-asset-v1.schema.json
```

It preserves Canonical data separately from deterministic/derived data and keeps unavailable information explicit rather than inventing values.

Deterministic structural projection may populate exact source facts such as:

- one unambiguous exported symbol;
- exported function signatures;
- exact return expressions;
- exact import/require sources;
- source-derived semantic search terms.

It does **not** convert an exported function name into a semantic capability, does not invent `use_when` / `do_not_use_when`, and does not promote partial structural facts into a fully known contract.

Per-asset bundle:

```text
asset.json
knowledge-units.jsonl
relationships.jsonl
cases.jsonl
manifest.json
```

## Current CLI

```bash
node src/cli.js search --query "http retry" --language JavaScript --layer Feature
node src/cli.js show <asset-id> --section architecture
node src/cli.js validate <asset-id>
node src/cli.js repository-candidate --repo <git-directory> --revision <40-char-sha> --spec <json-file> [--asset-root <path>] [--output <outside-directory>] --json
node src/cli.js register /path/to/completed-asset
node src/cli.js build-index
node src/cli.js verify-index
node src/cli.js export-reusable-assets --output <directory>
node src/cli.js preflight-kb-delivery <delivery-directory>
node src/cli.js publish-kb-delivery <delivery-directory> --kb-root <directory>
node src/cli.js verify-kb-active <delivery-directory> --kb-root <directory>
```

`repository-candidate` without `--output` performs assessment only. With `--output`, it materializes a validated non-registered Candidate outside the Catalog working tree. Registration remains an explicit separate operation.

A command being documented does not by itself prove real Server/PC transport or KB runtime success. Cross-host transport remains unproven until a concrete bridge is configured and verified.

## Verification

```bash
npm test
npm run verify
npm run check
```

Current automated regression covers existing Catalog behavior plus Reusable Asset schema/export determinism and exact-checkout provenance, optional-README export compatibility, exact-revision full/incremental/unchanged repository intake, exact-revision Repository Candidate assessment/materialization/CLI boundaries, KB delivery preflight/idempotency/ACTIVE authority, TGserver adapter boundaries, structural analysis, Granite controller constraints, DebugAI MCP mapping, Astera QCE transport, and Factory inspection orchestration.

Acceptance is based on expected output/state, regression, important failure cases, schema/integrity checks, and runtime/provider readback where relevant. Build or CI success alone is not a production/runtime PASS.

## Existing assets

The current branch is stacked on the 80-asset reusable export work from PR #4. Existing Asset identity, Source, tests, Evidence, Manifest, hashes, and provenance remain canonical inputs to Factory v1.

Generated Candidate or KB data is not committed as canonical source merely because it was materialized or exported. The Catalog remains the reproducible source of truth after explicit admission.

## Legacy GPT work-control material

The old ChatGPT-specific Work Control files are not Factory v1 design authority. Workspace/development control now comes from server-core and current project instructions. Legacy files are retained temporarily only until implementation cleanup can remove them without mixing cleanup with Factory correctness.
