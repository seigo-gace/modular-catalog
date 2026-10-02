# ModuleCatalog

ModuleCatalog is the canonical repository and processing factory for reusable development assets.

It keeps verified Source / Design / Logic / Architecture / Contract / Test / Evidence / Provenance together, converts them into reusable Knowledge Units and related metadata, and delivers KB-ready data without fabricating missing facts.

## Current design authority

- Factory v1: [`docs/REUSABLE_KNOWLEDGE_FACTORY_V1.md`](docs/REUSABLE_KNOWLEDGE_FACTORY_V1.md)
- Factory design delta: [`docs/DESIGN_DELTA_FACTORY_V1.md`](docs/DESIGN_DELTA_FACTORY_V1.md)
- Previous Catalog architecture baseline: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Asset format: [`docs/ASSET_FORMAT.md`](docs/ASSET_FORMAT.md)
- Reusable-data audit: [`docs/REUSABLE_ASSET_DATA_AUDIT_20261001.md`](docs/REUSABLE_ASSET_DATA_AUDIT_20261001.md)

The Factory v1 design is the current implementation baseline on the factory feature branch. GitHub source completion, Server runtime, and KB delivery are separate states and must not be conflated.

## Fixed boundaries

Factory input:

```text
Git repository
+
TGserver logs through TGserver HTTP API
```

Optional existing capabilities are consumed through their established boundaries only:

```text
AI Core Router API -> Granite Debug Controller
DebugAI MCP        -> analyze / verify
Astera APIs        -> Evidence Search / Quality Completion evaluation
```

ModuleCatalog does not modify AI Core, DebugAI, Astera v8, TGserver, or the KB runtime.

Factory responsibility ends after a KB-ready bundle is sent through the agreed KB receiving contract and its receipt/hash/count are verified. KB-side BM25 / Vector / Knowledge Graph / MCP/search runtime remains outside ModuleCatalog.

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
node src/cli.js register /path/to/completed-asset
node src/cli.js build-index
node src/cli.js verify-index
node src/cli.js export-reusable-assets --output <directory>
```

The factory branch verifies and repairs CLI/runtime gaps as implementation proceeds. A command being documented does not by itself prove its implementation or runtime success.

## Verification

```bash
npm test
npm run verify
npm run check
```

Acceptance is based on expected output/state, regression, important failure cases, schema/integrity checks, and runtime/provider readback where relevant. Build or CI success alone is not a production/runtime PASS.

## Existing assets

The current branch is based on the 80-asset reusable export work from PR #4. Existing Asset identity, Source, tests, Evidence, Manifest, hashes, and provenance remain canonical inputs to Factory v1.

Generated KB data is not committed as canonical source merely because it was exported. The Catalog remains the reproducible source of truth.

## Legacy GPT work-control material

The old ChatGPT-specific Work Control files are not Factory v1 design authority. Workspace/development control now comes from server-core and current project instructions. Legacy files are retained temporarily only until implementation cleanup can remove them without mixing cleanup with Factory correctness.
