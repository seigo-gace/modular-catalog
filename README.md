# ModuleCatalog

ModuleCatalog is the canonical repository and processing factory for reusable development assets.

It keeps verified Source / Design / Logic / Architecture / Contract / Test / Evidence / Provenance together, converts them into reusable Knowledge Units and related metadata, and delivers KB-ready data without fabricating missing facts.

## Current design authority

- Factory v1: [`docs/REUSABLE_KNOWLEDGE_FACTORY_V1.md`](docs/REUSABLE_KNOWLEDGE_FACTORY_V1.md)
- TGserver ZERO / CHAT evidence integration: [`docs/TGSERVER_ZERO_INTEGRATION.md`](docs/TGSERVER_ZERO_INTEGRATION.md)
- GPT final review / periodic admission: [`docs/GPT_FINAL_REVIEW_AND_PERIODIC_ADMISSION_V1.md`](docs/GPT_FINAL_REVIEW_AND_PERIODIC_ADMISSION_V1.md)
- Repository Candidate: [`docs/REPOSITORY_ASSET_CANDIDATE_V1.md`](docs/REPOSITORY_ASSET_CANDIDATE_V1.md)
- KB delivery / ACTIVE readback contract: [`docs/KB_DELIVERY_CONTRACT_V1.md`](docs/KB_DELIVERY_CONTRACT_V1.md)
- Server-to-Master-PC pull transport: [`docs/KB_PULL_TRANSPORT_V1.md`](docs/KB_PULL_TRANSPORT_V1.md)
- Runtime approved-admission worker: [`docs/RUNTIME_ADMISSION_WORKER_V1.md`](docs/RUNTIME_ADMISSION_WORKER_V1.md)
- Factory design delta: [`docs/DESIGN_DELTA_FACTORY_V1.md`](docs/DESIGN_DELTA_FACTORY_V1.md)
- Previous Catalog architecture baseline: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Asset format: [`docs/ASSET_FORMAT.md`](docs/ASSET_FORMAT.md)
- Reusable-data audit: [`docs/REUSABLE_ASSET_DATA_AUDIT_20261001.md`](docs/REUSABLE_ASSET_DATA_AUDIT_20261001.md)

The Factory v1 design is the current implementation baseline on the factory feature branch. GitHub source completion, candidate materialization, Catalog registration, Server runtime, GPT final review, KB admission eligibility, KB delivery, KB `ACCEPTED`, and KB `ACTIVE` are separate states and must not be conflated.

## Fixed boundaries

Factory evidence inputs are kept separate:

```text
pinned Git repository / exact revision
+
sanitized TGserver ZERO central Reader Artifact produced by seigo-gace/TGserver
```

ModuleCatalog does **not** call TGserver `/search` directly. Runtime/Server log lookup is owned by the TGserver ZERO central Reader, which performs the authenticated legacy `/search` request and publishes sanitized `tgserver-zero-search-meta.json` + `tgserver-zero-search-result.json` evidence for CHAT. Cloudflare Access and TGserver credentials are not copied into this repository. ModuleCatalog validates the Artifact generation, exact repository, explicit stream, and central-Reader-supplied registered project ID before using observations.

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

For a generic repository that is not already laid out as a Catalog Asset, ModuleCatalog supports a separate non-registered Candidate boundary:

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

The registered-Asset-to-KB path is:

```text
Catalog Asset / source
  -> exact Git revision intake / optional incremental diff
  -> integrity + existing evidence validation
  -> ast-grep deterministic JS/TS structural extraction
  -> exact source-derived symbol / signature / return / import-require projection
  -> explicit reuse-fact projection with traceable derivation
  -> Reusable Asset Schema v1 (Ajv Draft 2020-12)
  -> deterministic full-snapshot bundle + hash/count preflight
  -> portable reuse smoke outside the Catalog working tree
  -> GPT Chat final review of exact commit + manifest + review-rule version
  -> GPT_APPROVED plus mandatory machine gates
  -> Server outbox-local temporary build
  -> atomic seal as <server-outbox>/<catalog-commit> only when manifest SHA-256 equals the approved identity
  -> Master PC pulls the exact commit through existing SSH/SCP client with the same approved manifest SHA-256 supplied explicitly
  -> require remote manifest SHA-256 == approved manifest SHA-256 before SCP
  -> F:\G-ACE-KB target-local temporary copy
  -> require local top-level manifest SHA-256 == approved manifest SHA-256
  -> same-filesystem atomic ready/<catalog-commit> publish
  -> existing KB inbox processor
  -> KB ACCEPTED / ACTIVE / Current readback with the same approved identity
  -> existing KB Deep health gate
```

The cross-host transport does not create a Windows OpenSSH Server, SFTP daemon, SMB share, Syncthing service, new upload API, or required reverse VPS-to-PC filesystem mount. WireGuard may carry SSH only if independently live-verified; ModuleCatalog does not create or assume it.

Exporter provenance is fail-closed: an explicit `--catalog-commit` must equal the checked-out Catalog `HEAD`, and the Catalog Working Tree must be clean. A caller cannot label uncommitted content or current Working Tree content with another revision.

`README.md` is optional under the existing Asset admission format. The exporter emits a README Knowledge Unit only when the registered Asset actually contains a non-empty README; it never fabricates one.

The diagnostic/verification coordination path is separately bounded:

```text
exact repo + revision + optional sanitized TGserver ZERO observations
  -> repository revision resolution before evidence processing
  -> exact repo/stream/project binding from central Reader metadata
  -> explicit/deterministic failure signals
  -> Granite Debug Controller when a signal exists
  -> DebugAI MCP analyze/verify when selected
  -> optional Astera QCE evaluation when an explicit QCE request is supplied
  -> INSPECTION_COMPLETE
```

Direct Project-to-TGserver adapter injection fails closed with `TGS_DIRECT_ACCESS_DISABLED`. `INSPECTION_COMPLETE`, `READY_FOR_ADMISSION`, Catalog registration, GPT approval, sealed transport state, and KB `COMPLETE` are distinct states.

## Development Probe / CHAT evidence readback

`.github/workflows/dev-probe.yml` is the repository-owned development evidence route. It accepts no shell command from an Issue. The `[DEV-PROBE]` Issue is only a trigger, and the workflow executes the fixed repository commands `npm run check` and `npm run verify:portable` after `npm ci`.

The workflow is owner-only, uses read-only repository/Issue permissions, and uploads bounded logs plus exact run metadata as `dev-probe-evidence-<run-id>`. CHAT can read the Actions Job Log and Artifact directly instead of requiring Master to copy terminal output.

The feature branch also permits owner-authored same-repository Pull Request events so the probe itself can be verified before main merge. The Issue-triggered path becomes live only after this workflow exists on the repository default branch; this branch does not bypass the existing main-merge approval boundary.

Current TGserver ZERO registry state for ModuleCatalog is `UNREGISTERED`. No P-number is guessed or reused. Runtime-log retrieval remains `NOT_EXECUTED` until a separate TGserver-owned registration/producer onboarding change supplies the formal repo/stream/project mapping. See [`docs/TGSERVER_ZERO_INTEGRATION.md`](docs/TGSERVER_ZERO_INTEGRATION.md).

## Five-level Module Architecture

```text
Part
  -> Feature
    -> Component
      -> System
        -> Application System
```

This is a logical architecture. It does not require one directory per level, and a snapshot does not have to contain an Asset at all five levels. Every registered Asset must declare at least one valid value from the five-level vocabulary. Invalid layer values fail mechanically. The Factory does not invent parent Assets or synthetic relationships merely to populate missing levels.

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

Reuse-fact projection remains bounded to recorded or mechanically observed facts:

- `applicability.use_when` uses the recorded `meta.purpose` when that purpose is specific;
- when the purpose is only the Asset name or generic Skill boilerplate, `use_when` is derived from the exact observed input/output interface instead of copying the weak label;
- the Canonical purpose itself is never rewritten by this projection;
- explicit failure statements and exact failure-bearing return expressions may populate failure/error behavior;
- explicit no-side-effect wording may populate side-effect behavior;
- `contract.status=known` requires an observed input/output interface and recorded Normal + User evidence PASS;
- every projected field retains a `derivation.derived_fields` source record.

The Factory does not turn an exported function name into an unsupported semantic capability, does not invent a plausible human use case, and does not silently convert AI interpretation into Canonical data.

Per-asset bundle:

```text
asset.json
knowledge-units.jsonl
relationships.jsonl
cases.jsonl
manifest.json
```

## Portable reuse smoke

The Catalog Verify and Chat Factory paths copy each registered Asset outside the Catalog working tree and execute the Asset's recorded Normal/User Node test commands from that copied root.

This proves the recorded behavior does not depend on the original Catalog filesystem location. It is intentionally weaker than unrelated real-project integration:

```text
portable_reuse_smoke_proven=true
!=
real_cross_project_reuse_proven=true
```

The distinction is preserved in Factory results and GPT final review.

## GPT final review and machine admission gates

GPT review is bound to the exact Catalog commit, snapshot manifest SHA-256 and review-rule version. Review states are exactly:

```text
GPT_APPROVED
GPT_REJECTED
GPT_HOLD
```

`GPT_APPROVED` alone cannot produce a runtime admission ticket. Current review rule `gpt-final-review-v2` also requires the exact Factory result to satisfy:

```text
contract_unknown_count=0
applicability_empty_count=0
applicability_unknown_derivation_count=0
applicability_from_canonical_purpose_count + applicability_from_interface_count = asset_count
known_unverified_count=0
module_architecture_layer_gate_pass=true
invalid_layer_values=[]
portable_reuse_smoke_proven=true
portable_reuse_asset_count=asset_count
portable_reuse_command_count>=asset_count*2
```

Real unrelated-project reuse remains a separate evidence class and is not relabeled as proven by this gate.

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
node src/cli.js prepare-kb-outbox --outbox <existing-server-directory> --json
node src/cli.js preflight-kb-delivery <delivery-directory>
node src/cli.js publish-kb-delivery <delivery-directory> --kb-root <directory>
node src/cli.js verify-kb-active <delivery-directory> --kb-root <directory>
```

`repository-candidate` without `--output` performs assessment only. With `--output`, it materializes a validated non-registered Candidate outside the Catalog working tree. Registration remains an explicit separate operation.

`prepare-kb-outbox` generates and preflights one complete full snapshot in an outbox-local temporary directory, then atomically seals it under the exact Catalog commit. Same commit + same manifest is idempotent; conflicting identity fails closed.

For the real cross-host path, the Master PC uses:

```text
scripts/pull-modulecatalog-kb-delivery-windows.ps1
```

Required identity inputs include the explicit `CatalogCommit` and the exact GPT-approved `ExpectedManifestSha256`; the script never infers approval identity from the remote Server. It uses Windows `ssh.exe` / `scp.exe` as a client only, rejects a remote manifest whose SHA-256 differs from the approved value before transfer, pulls the exact commit into a temporary directory on the target `F:` filesystem, requires the local manifest to retain the approved SHA-256, atomically publishes to the standard KB `ready` directory, invokes the existing KB inbox processor, verifies matching ACTIVE/current state and runs the existing Deep health check.

A command being documented or source/CI passing does not prove real Server/PC transport or KB runtime success. Cross-host runtime remains unverified until the intended Server and Master PC execute the path successfully.

## Verification

```bash
npm test
npm run verify
npm run verify:portable
npm run check
```

Current automated regression covers existing Catalog behavior plus Reusable Asset schema/export determinism and exact-checkout/clean-worktree provenance, traceable reuse-fact projection, generic-purpose fallback to observed interfaces, five-level layer validation, optional-README export compatibility, exact-revision full/incremental/unchanged repository intake, exact-revision Repository Candidate assessment/materialization/CLI boundaries, KB delivery preflight/idempotency/ACTIVE authority, sealed Server outbox identity/idempotency/conflict behavior, Windows pull-transport source constraints including approved-manifest-hash binding and PowerShell parsing, TGserver ZERO sanitized-Artifact intake and direct-access rejection, structural analysis, Granite controller constraints, DebugAI MCP mapping, Astera QCE transport, portable reuse smoke, Chat Factory result evidence, GPT final-review identity, and mandatory machine admission gates.

Acceptance is based on expected output/state, regression, important failure cases, schema/integrity checks, and runtime/provider readback where relevant. Build or CI success alone is not a production/runtime PASS.

## Existing assets

The current branch is stacked on the 80-asset reusable export work from PR #4. Existing Asset identity, Source, tests, Evidence, Manifest, hashes, and provenance remain canonical inputs to Factory v1.

Generated Candidate or KB data is not committed as canonical source merely because it was materialized or exported. The Catalog remains the reproducible source of truth after explicit admission.

## Legacy GPT work-control material

The old ChatGPT-specific Work Control files are not Factory v1 design authority. Workspace/development control now comes from server-core and current project instructions. Legacy files are retained temporarily only until implementation cleanup can remove them without mixing cleanup with Factory correctness.
