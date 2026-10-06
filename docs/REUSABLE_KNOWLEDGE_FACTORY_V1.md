# Reusable Knowledge Factory v1

Status: Active Factory v1 implementation authority
Project: ModuleCatalog
Scope owner: ModuleCatalog
Repository Candidate authority: `docs/REPOSITORY_ASSET_CANDIDATE_V1.md`
KB delivery authority: `docs/KB_DELIVERY_CONTRACT_V1.md`

## 1. Purpose

ModuleCatalog is the canonical repository and processing factory for reusable development assets.

The Factory converts exact-revision repository facts and TGserver runtime evidence into reusable asset data, preserves provenance and uncertainty, validates the result, transports complete bundles to the G-ACE KB inbox, and does not claim end-to-end completion until the KB reports the same Catalog commit as `ACTIVE`.

The Factory is an internal development-efficiency system. It is not a public product and is not optimized for marketplace features, multi-tenant UX, or independent external consumption.

Primary goal:

```text
proven reusable source assets
+ observed runtime/log evidence
-> minimum necessary processing
-> immediately consumable KB data
-> atomic delivery
-> KB ACTIVE receipt verification
```

Development time is minimized by reusing proven public OSS and existing G-ACE capabilities. New code is limited to ModuleCatalog-specific responsibility and thin adapters.

### Current implementation boundary

Source-side Factory v1 currently implements:

- exact Git revision intake with `FULL_SNAPSHOT`, `INCREMENTAL`, and `UNCHANGED` states;
- generic repository -> non-registered Repository Asset Candidate assessment/materialization from exact Git objects;
- existing explicit Catalog admission through the separate `register` operation;
- existing registered-Asset validation and Reusable Asset v1 export;
- deterministic JS/TS structural projection through ast-grep;
- TGserver HTTP search intake;
- Granite Debug Controller routing through AI Core;
- DebugAI MCP `analyze` / `verify` only;
- Astera QCE through the sanctioned `/v1/evaluate` contract;
- KB delivery preflight, atomic filesystem publish semantics, and ACCEPTED/ACTIVE/Current readback logic against controlled filesystem fixtures.

The following remain separate/unproven boundaries:

- direct Astera Evidence Search from ModuleCatalog because the current Astera transport authenticates the internal caller as `service=astera-main` and exposes no sanctioned ModuleCatalog caller contract;
- real Server-to-Master-PC transport bridge;
- real KB `ACTIVE` end-to-end execution;
- Main merge / Deploy / Production activation.

GitHub CI success is source evidence only and is never reported as Production/runtime PASS.

## 2. Fixed responsibility boundary

### ModuleCatalog owns

1. repository intake and exact revision identity;
2. explicit generic-repository Candidate construction without Canonical invention;
3. TGserver log retrieval through its HTTP API;
4. canonical asset integrity verification;
5. deterministic structural extraction;
6. Knowledge Unit / Case / Relationship construction;
7. metadata and contract projection;
8. Canonical / Deterministic Derived / AI Derived / Unknown separation;
9. DebugAI invocation decision and evidence return handling;
10. optional Astera evaluation only through sanctioned ModuleCatalog-callable API contracts;
11. schema and integrity gates;
12. deterministic `gace.reusable-asset.v1` bundle generation;
13. atomic transport to the KB `ready` boundary;
14. delivery retry/idempotency policy;
15. KB `ACCEPTED` / `ACTIVE` receipt readback;
16. end-to-end success only after the delivered Catalog commit is `ACTIVE`.

### G-ACE KB owns after delivery

The KB responsibility begins when a complete delivery is visible in its inbox.

It owns:

- delivery acceptance and integrity re-check;
- searchable projection generation;
- BM25 / Vector / Knowledge Graph integration;
- MCP search verification;
- staging validation;
- atomic Current switch and rollback;
- current snapshot authority;
- continuing runtime health checks.

The KB does not clone/fetch ModuleCatalog as an operational intake path and does not recreate the search-ready data that ModuleCatalog already delivered.

### ModuleCatalog does not own

- KB internal indexing/search/runtime implementation;
- Astera v8 implementation or modification;
- DebugAI implementation or modification;
- AI Core router/model runtime implementation or modification;
- direct Telegram / Redis / Meilisearch access;
- source repository mutation or automatic patch application;
- a second debugging workflow;
- a second AI router.

## 3. Input authorities

### 3.1 Repository

Repository data is the implementation/design authority for the asset being processed.

Typical canonical sources:

- source code;
- README / Design / Logic / Architecture when present;
- explicit contracts and schemas;
- tests;
- evidence records;
- manifest/hash for registered Catalog Assets;
- exact Git revision, Git object identity, and file paths.

An exact Git commit/revision is always retained in provenance.

For a repository that is not already organized as a registered Catalog Asset, the Factory does not infer Canonical metadata from arbitrary files. It requires an explicit Canonical declaration plus an explicit mapping for Design, Logic, Architecture, Evidence, Source, Normal Test, and User Test material. Missing required repository facts remain `INCOMPLETE`.

Candidate bytes are read from exact Git blobs, not from mutable Working Tree state. Git symlinks are rejected from the exact tree before materialization.

### 3.2 TGserver

TGserver is the runtime/observed-log source. It is accessed only through the TGserver HTTP API.

Current supported search filters are:

```text
query
project_id
severity
from
to
```

The Factory must not read Telegram, Redis, or Meilisearch directly.

Repository and TGserver evidence have different meanings:

```text
Repository = what is implemented/declared
TGserver   = what was observed at runtime
```

Neither source silently overwrites the other. Contradiction is recorded and may trigger DebugAI analysis.

## 4. Data truth classes

Every produced field is one of four classes.

### CANONICAL

Directly recorded in an authoritative source without semantic invention.

Examples: explicit meta field, exact source path, test assertion, evidence result, Git commit, Git object, manifest hash.

### DETERMINISTIC_DERIVED

Produced by a repeatable rule from canonical input.

Examples: token/keyword projection, symbol list from structural analysis, exact dependency edge, normalized test-case identifier, file/content hash.

### AI_DERIVED

Produced by an AI interpretation and therefore never silently promoted to Canonical.

Factory v1 does not use AI merely to fill metadata gaps. AI use in v1 is limited to the Debug Controller path. If an AI-derived field is introduced later, it must include exact derivation sources, model route, output contract, and verification state.

### UNKNOWN / NOT_RECORDED

Used when available evidence is insufficient.

The Factory never fabricates a canonical value to make the output look complete.

## 5. Minimal technology decision

Factory v1 intentionally avoids a new workflow platform or database.

### Foundation

Existing ModuleCatalog Node.js 22 codebase.

Reason: it already owns validation, asset scanning, hashing, export and tests. Introducing Kestra, Dagster, Temporal, or another orchestrator would duplicate responsibility and lengthen completion time.

### Adopted

#### Native Git object/tree commands

Purpose: exact revision identity, incremental diff, exact Candidate blob reads, Git-mode type checks, and symlink rejection without trusting mutable Working Tree bytes.

#### Ajv

Purpose: execute `reusable-asset-v1.schema.json` as a real JSON Schema Draft 2020-12 gate.

#### ast-grep

Purpose: deterministic structural extraction from supported source languages.

ast-grep already uses Tree-sitter internally. Factory v1 therefore does not add a second direct Tree-sitter dependency.

### Adapter-ready, not mandatory for v1 completion

#### SCIP indexers

Purpose: deeper cross-file definition/reference/implementation relations when a maintained indexer exists for the source language.

Factory v1 does not require SCIP to process an asset. Unsupported or unavailable semantic relations remain unknown instead of blocking canonical export.

### Explicitly not included in v1

- Kestra / Dagster / Temporal / Prefect;
- DuckDB;
- in-toto runtime dependency;
- a new Vector/Graph/BM25 engine;
- LiteLLM / Portkey / another AI router;
- a new debugging engine;
- a broad multi-agent layer.

Existing manifest/hash/derivation records are sufficient for Factory v1 provenance. Additional infrastructure is added only when an observed requirement cannot be met by the current design.

## 6. Logical architecture

The five-level Module Architecture is retained as the project architecture model.

```text
Part
  -> Feature
    -> Component
      -> System
        -> Application System
```

### Part

- RepositoryRevision
- RepositoryAssetCandidate
- GitObjectIdentity
- TGLogRecord
- ContentHash
- SourceSymbol
- KnowledgeUnit
- CaseRecord
- Relationship
- DerivationRecord
- ValidationResult
- DeliveryReceipt
- DebugDecision

### Feature

- Intake
- Candidate Assessment
- Candidate Materialization
- Integrity Verification
- Structural Extraction
- Knowledge Projection
- Case Normalization
- Relationship Resolution
- Debug Escalation
- External Evaluation
- Schema Validation
- Bundle Generation
- Atomic KB Publish
- KB Receipt Verification

### Component

- Factory Intake Component
- Asset Candidate Component
- Asset Analysis Component
- Knowledge Factory Component
- Verification Component
- Delivery Component

### System

Reusable Knowledge Factory

### Application System

Repository-to-KB Reusable Development Asset System

The five levels are logical. They do not require five directory levels or one file per Part.

## 7. Runtime architecture

```text
Git repository ------------------+
                                 |
TGserver HTTP /search -----------+----> Intake
                                         |
                                         v
                              Integrity / Revision Gate
                                         |
                       +-----------------+------------------+
                       |                                    |
            registered Catalog Asset            generic repository asset
                       |                                    |
                       |                         explicit declaration + mapping
                       |                                    |
                       |                         Candidate assessment/materialize
                       |                                    |
                       |                         explicit register only
                       +-----------------+------------------+
                                         v
                            Deterministic Analysis Layer
                              |                |
                           ast-grep       explicit contracts
                              |                |
                              +-------+--------+
                                      v
                              Knowledge Factory
                         asset / KU / case / relation
                                      |
                                      v
                         Source-vs-runtime consistency
                                      |
                       +--------------+---------------+
                       |                              |
                 consistent                     contradiction /
                                                 failure signal
                       |                              |
                       |                              v
                       |                     Granite Debug Controller
                       |                              |
                       |                              v
                       |                         DebugAI MCP
                       |                     analyze / verify only
                       |                              |
                       +--------------+---------------+
                                      v
                         optional external evaluation
                            Astera QCE API
                    Evidence Search = unavailable until
                   sanctioned ModuleCatalog caller exists
                                      |
                                      v
                         Canonical / Derived Gate
                                      |
                                      v
                              Ajv Schema Gate
                                      |
                                      v
                          deterministic Export Bundle
                                      |
                                      v
                         temporary delivery directory
                                      |
                          validate/hash/readback
                                      |
                                      v
                 atomic move/rename to KB ready/<delivery-id>
                                      |
                                      v
                    KB: processing -> ACCEPTED -> ACTIVE
                                      |
                                      v
                     Catalog verifies ACTIVE receipt
```

## 8. Factory processing logic

### Stage 0: Run identity

A run receives:

- project_id when runtime evidence is requested;
- repository path/identifier;
- exact repository revision;
- optional previous exact revision;
- optional asset_id filter;
- optional generic-repository Candidate specification;
- TGserver time window or cursor;
- output/delivery target contract.

No mutable `latest`, branch name, tag, or bare `HEAD` reference is stored as provenance. The exact resolved revision is recorded.

### Stage 1: Intake

1. resolve the exact repository revision against the real Git object database;
2. if a previous exact revision exists, compute deterministic changed paths with rename preservation;
3. for registered Catalog Assets, enumerate selected asset/source files and validate existing Canonical material;
4. for generic repositories, assess explicit Candidate declaration/file mappings and keep missing requirements explicit;
5. read Candidate content from exact Git blobs, not mutable Working Tree bytes;
6. query TGserver by project_id and relevant time/severity boundaries when requested;
7. redact/reject secrets according to existing Catalog safety rules;
8. attach source references, never raw secret material.

Candidate states are distinct:

```text
INCOMPLETE
READY_TO_MATERIALIZE
READY_FOR_ADMISSION
REGISTERED
```

Only the existing explicit `register` operation moves a validated Candidate into Canonical Catalog storage and creates its Manifest/index state.

### Stage 2: Integrity

Existing Catalog manifest/hash validation is reused for registered Assets.

Failure is fail-closed for Canonical asset publication:

- missing required file;
- manifest mismatch;
- hash mismatch;
- symlink/path escape;
- duplicate identity;
- invalid/unresolved revision identity;
- Candidate declaration revision mismatch;
- Candidate Git object/type mismatch.

Revision-bound reusable export additionally requires:

```text
explicit --catalog-commit (when supplied) == checked-out HEAD
AND
Catalog Working Tree is clean
```

This prevents current Working Tree bytes from being labeled with a different or stale Catalog revision.

### Stage 3: Deterministic extraction

Priority order:

```text
explicit canonical contract
-> existing metadata
-> test/evidence projection
-> ast-grep structural extraction
-> optional semantic indexer
-> UNKNOWN
```

The Factory never calls AI simply because a deterministic extractor returned no answer.

Current ast-grep projection may emit only traceable source facts such as exact exported symbol identity, exported function signature, exact return expressions, and import/require sources. A function name such as `run` is not converted into a semantic capability merely because it is exported.

### Stage 4: Knowledge construction

For each parent asset, construct only meaningful units from present source material:

- overview/discovery;
- README documentation only when a non-empty README actually exists;
- design;
- logic;
- architecture;
- contract facts when deterministically supported;
- code/symbol;
- test case;
- evidence;
- runtime observation/remediation when supported by evidence.

Every unit retains `parent_asset_id` and source references.

`README.md` is optional under the registered Asset admission contract. The exporter must not invent it or require it merely because the current 80-Asset compatibility set happens to contain one.

### Stage 5: Case normalization

Test cases preserve exact source test and recorded evidence.

Normalized fields are populated only when extractable without invention:

- scenario;
- input;
- expected;
- actual;
- result;
- source_test;
- evidence references.

A PASS means only the boundary explicitly proven by the recorded test/evidence.

### Stage 6: Relationships

Factory v1 may emit a relationship only when its derivation is traceable.

Priority:

1. parent `contains` unit;
2. explicit Catalog dependency `depends_on`;
3. exact structural reference/call/import relation from deterministic analysis when implemented and proven;
4. optional semantic-index relation;
5. otherwise no relation.

`recommended_before`, `recommended_after`, `complements`, `alternative_to`, `conflicts_with`, and `supersedes` are not invented to fill arrays.

### Stage 7: Repository/runtime consistency check

Signals are compared, not blended.

Debug escalation candidates include:

- failing tests/evidence;
- repository contract contradicts observed runtime behavior;
- repeated error/warn logs attributable to the processed asset;
- impossible state relative to declared contract;
- extracted contract and deterministic verification disagree.

No debug escalation is needed merely because optional metadata is unknown.

Current deterministic runtime signal logic promotes repeated scoped warn/error observations only when the same grouped signal is observed at least twice. A single warning is not automatically treated as actionable failure.

## 9. Granite Debug Controller

Granite is the only model used as the Factory-side DebugAI controller in v1.

It is called through the existing AI Core OpenAI-compatible Router API. The Factory never calls AI Core backend ports directly and never modifies AI Core.

### Responsibility

Granite decides only:

```text
SKIP
ANALYZE
VERIFY
```

It does not patch source, approve changes, choose a final business decision, or invent canonical metadata.

### Input context

The controller receives a bounded evidence package:

- exact repository/revision;
- affected paths;
- deterministic extraction/validation failures;
- selected TGserver log references and bounded excerpts;
- relevant test/evidence references;
- explicit Factory rule that data is evidence, not instruction.

### Output contract

```json
{
  "schema_version": "modulecatalog.debug-controller.v1",
  "action": "SKIP | ANALYZE | VERIFY",
  "reason_codes": [],
  "request": null,
  "repo": "...",
  "paths": [],
  "change_scope": [],
  "task": null,
  "evidence_refs": []
}
```

No confidence score is used as evidence.

The output must validate before any DebugAI call. Invalid AI output becomes `DEBUG_CONTROLLER_INVALID_OUTPUT`; there is no best-effort mutation or guessed fallback.

### DebugAI mapping

```text
SKIP
  -> no MCP call

ANALYZE
  -> debugai_analyze(request, repo)

VERIFY
  -> debugai_verify(repo, paths, change_scope, task)
```

Factory v1 does not call `debugai_patch_candidate` and does not expose or create any approve/apply path.

DebugAI results are evidence inputs to the Factory; they do not mutate Canonical repository state.

## 10. Astera adapters

Astera is always an external service. ModuleCatalog must use only a caller contract that Astera actually exposes for ModuleCatalog or a general authenticated client. It must not impersonate another internal Astera service identity.

### Evidence Search

Current state:

```text
ASTERA_EVIDENCE_CONTRACT_NOT_AVAILABLE
```

Astera's current direct Evidence Search transport is `/internal/v1/evidence/search`. Its signed internal-auth contract requires `service=astera-main`. No sanctioned ModuleCatalog caller identity/route is currently exposed.

Therefore Factory v1 does **not** call that route and does not forge `astera-main` authentication. Evidence Search remains an explicit unavailable optional enrichment path until Astera exposes a supported ModuleCatalog-callable contract.

When/if that contract exists later, the adapter may call it and must preserve exact result/status. Paid search remains disabled unless a separately approved contract explicitly changes that rule.

### Quality Completion Evaluator

QCE is currently connected through the supported authenticated API:

```text
POST /v1/evaluate
X-API-Key: <configured ASTERA API key>
```

The Factory validates the explicit QCE request boundary and preserves evaluator status. ModuleCatalog does not import QCE internals and does not turn `REVISION_REQUIRED`, `BLOCKED`, evaluator failure, invalid JSON, or transport failure into PASS.

Astera failure/unavailability remains an explicit state; it is never reported as PASS.

## 11. Schema and output gates

Before delivery:

1. Reusable Asset Schema validation passes through Ajv Draft 2020-12;
2. every KU has a valid parent asset;
3. every relationship endpoint resolves or is explicitly external;
4. Case result does not exceed its evidence boundary;
5. all derived fields include derivation metadata;
6. Canonical fields are never sourced only from AI interpretation;
7. file hashes and bundle hash match generated content;
8. top-level manifest declares `schema_version=1`, `format=gace.reusable-asset.v1`, repository, exact commit, asset count and per-asset KU/relationship/case counts;
9. explicit Catalog commit identity matches the checked-out exact HEAD;
10. the Catalog Working Tree is clean before revision-bound export;
11. output is reproducible for identical Canonical inputs/revision and identical accepted external evidence set.

## 12. Bundle and producer/consumer contract

Delivery layout is fixed to the KB receiver contract:

```text
<delivery-root>/
├─ manifest.json
└─ assets/
   └─ <asset-id>/
      ├─ asset.json
      ├─ knowledge-units.jsonl
      ├─ relationships.jsonl
      ├─ cases.jsonl
      └─ manifest.json
```

Per-asset and top-level manifests retain exact source/catalog provenance and hashes.

The current KB consumer contract already accepts the present producer baseline of:

```text
format = gace.reusable-asset.v1
current compatibility fixture = 80 assets / 720 KUs / 160 cases
```

These numbers are current compatibility evidence, not permanent hard-coded Factory limits.

Runtime-only timestamps must not make content hashes nondeterministic.

## 13. Incremental processing

Repository intake currently resolves exact revision pairs and classifies:

```text
no previous revision
-> FULL_SNAPSHOT

previous != current
-> INCREMENTAL

previous == current
-> UNCHANGED
```

Incremental diff preserves rename source/destination paths. Existing Catalog paths under `assets/<asset-id>/...` project to affected Asset IDs; other changed paths remain explicit as `unmapped_paths` instead of being silently discarded.

The intended reusable processing policy remains:

```text
unchanged asset hash + unchanged relevant evidence cursor
-> reuse prior deterministic bundle / no reprocessing

changed asset hash
-> rebuild only affected asset

new asset
-> build only new asset

deprecated/superseded asset
-> publish lifecycle change, do not silently delete history
```

The KB activation model is still one full current ModuleCatalog snapshot. Incremental Factory work therefore reduces producer computation, but a delivery presented for activation represents the complete intended current snapshot unless the KB contract is explicitly extended later.

A full rebuild remains available as a recovery/verification path.

## 14. KB delivery contract

### 14.1 Standard inbox

Current Master PC root:

```text
F:\G-ACE-KB\data\knowledge-inbox\modulecatalog\
├─ ready\
├─ processing\
├─ processed\
└─ failed\
```

A complete delivery is published under:

```text
ready\<delivery-id>\
```

For Factory v1 the delivery id is the exact 40-character Catalog commit. This aligns the transport identity with the KB receipt authority and avoids a second sequencing namespace.

### 14.2 Atomic publish

The Factory must never stream/copy an incomplete bundle directly into `ready`.

Required publish algorithm:

```text
1. build/export in a producer-local working directory
2. copy to a temporary directory outside `ready` visibility
3. verify all files/counts/hashes in the temporary copy
4. ensure no complete delivery currently exists in `ready`
5. move/rename the completed temporary directory into ready/<catalog-commit>
6. re-read ready/<catalog-commit>/manifest.json
7. verify exact commit/hash/count identity
```

The top-level `manifest.json` is the completion marker expected by the KB inbox processor.

If the transport mechanism cannot guarantee an atomic directory move into the target filesystem, it must use a target-local temporary directory and perform the final rename on the target filesystem.

### 14.3 Single-ready authority: v1 decision

Factory v1 adopts **one complete ready delivery only**.

It does not add `sequence`, generation numbers, commit-time ordering, or `supersedes` fields merely to support multiple queued snapshots.

Reason: the KB currently has exactly one active ModuleCatalog snapshot and intentionally refuses to infer ordering. Adding producer sequencing now would expand the contract without a current need.

Before publishing, if another complete delivery already exists in `ready`, Factory v1 returns:

```text
KB_READY_OCCUPIED
```

It does not delete, replace, or reorder that delivery.

If multiple complete ready deliveries are ever required, ordering authority must be added as a separately versioned contract change on both producer and consumer.

### 14.4 ACCEPTED versus ACTIVE

Catalog completion states are distinct:

```text
PUBLISHED
-> KB ACCEPTED
-> KB ACTIVE
-> Factory COMPLETE
```

`ACCEPTED` proves intake/projection acceptance only.

`ACTIVE` proves the KB has completed its staging search/index/MCP gates, performed the Current switch, passed post-cutover MCP checks, and written the matching activation marker/receipt.

Factory v1 therefore considers end-to-end success only when:

- receipt status is `ACTIVE`;
- `catalogCommit` equals the delivered Catalog commit;
- `deliveryManifestSha256` equals the delivered top-level manifest hash;
- asset/KU/relationship/case counts equal the delivered manifest;
- no contradicting Current authority is reported.

### 14.5 Receipt authority

Receipt path:

```text
F:\G-ACE-KB\data\knowledge-intake\modulecatalog\receipts\<catalog-commit>.json
```

Current active authority:

```text
F:\G-ACE-KB\data\knowledge-records\modulecatalog-reusable-active.json
```

The Factory verifies both for final completion when accessible through the configured delivery/readback bridge.

A historical receipt that was once `ACTIVE` is not sufficient if the current activation marker points to another commit.

### 14.6 Idempotency and retry

Same commit + same manifest hash:

- if the receipt and Current marker both report that commit as `ACTIVE`, return success without re-delivery;
- if delivery is still in `ready` or `processing`, do not create a duplicate;
- if a previous attempt is archived in `failed`, a new delivery of the same commit is allowed only after the ready slot is clear and the producer bundle still matches the same manifest identity;
- if the same commit is presented with a different manifest hash, fail closed as `KB_DELIVERY_IDENTITY_CONFLICT`.

The Factory does not automatically retry forever. Retry is bounded and state-aware.

### 14.7 Failure handling

KB receiver failure may archive the claimed delivery under `failed`.

The Factory does not move/delete KB-owned `processing`, `processed`, `failed`, receipt, runtime-state, or Current files.

After failure, the Factory records the receipt/readback state and may republish only when:

- the KB ready slot is clear;
- no matching active Current already exists;
- the producer bundle still passes all gates;
- retry policy allows another attempt.

### 14.8 Transport bridge

The KB receiver is currently a Master-PC filesystem boundary. ModuleCatalog may run on another host, including the server.

Factory v1 therefore separates:

```text
bundle production
from
transport implementation
```

The Delivery Adapter accepts a configured target filesystem/bridge and must prove target-side atomic publish/readback semantics. It must not assume that a server process can directly access `F:`.

Until a concrete cross-host bridge is configured and verified, the transport state remains `KB_DELIVERY_NOT_CONFIGURED`. This does not block source-side Factory implementation/testing with a controlled filesystem fixture.

## 15. Failure states

Factory states are explicit and machine-readable. Current/required state vocabulary includes:

- `INPUT_INVALID`
- `REVISION_UNRESOLVED`
- `INTEGRITY_FAILED`
- `ASSET_CANDIDATE_INCOMPLETE`
- `ASSET_CANDIDATE_REVISION_MISMATCH`
- `CATALOG_REVISION_MISMATCH`
- `CATALOG_WORKTREE_DIRTY`
- `TGSEARCH_UNAVAILABLE`
- `STRUCTURAL_ANALYZER_UNAVAILABLE`
- `STRUCTURAL_EXTRACTION_FAILED`
- `DEBUG_NOT_REQUIRED`
- `DEBUG_CONTROLLER_INVALID_OUTPUT`
- `DEBUGAI_UNAVAILABLE`
- `DEBUGAI_FAILED`
- `ASTERA_EVIDENCE_CONTRACT_NOT_AVAILABLE`
- `QCE_UNAVAILABLE`
- `SCHEMA_INVALID`
- `BUNDLE_INTEGRITY_FAILED`
- `KB_DELIVERY_NOT_CONFIGURED`
- `KB_READY_OCCUPIED`
- `KB_DELIVERY_IDENTITY_CONFLICT`
- `KB_DELIVERY_FAILED`
- `KB_RECEIVER_BUSY`
- `KB_ACCEPTED_PENDING_ACTIVE`
- `KB_RECEIPT_MISMATCH`
- `KB_CURRENT_MISMATCH`
- `COMPLETE`

Availability failure of an optional enrichment path does not rewrite facts. Whether it blocks delivery is determined by whether a required field/gate depends on that path.

## 16. Security and mutation boundary

- Secrets are never stored in asset data, documents, prompts, logs, or bundle output.
- API keys/secrets are read from runtime configuration only.
- TGserver is queried through its HTTP API only.
- Astera is used through sanctioned API contracts only.
- ModuleCatalog never signs an internal Astera request as another service identity.
- DebugAI is used through MCP only.
- AI Core is used through its Router API only.
- Source repositories are read-only to the Factory.
- Generic Candidate materialization writes only to an explicitly selected directory outside the ModuleCatalog working tree.
- Factory v1 has no automated source patch/apply capability.
- KB delivery is the only intended external runtime write owned by this Factory.
- KB-owned processing/current/runtime state is read for verification but not mutated by ModuleCatalog.

## 17. Implementation status and remaining sequence

Implemented source-side steps on the Factory branch:

1. Reusable Asset export CLI and deterministic bundle generation;
2. executable Ajv schema validation and regression tests;
3. deterministic delivery manifest/count/integrity preflight;
4. filesystem Delivery Adapter with target-local temp + atomic rename + single-ready enforcement;
5. KB receipt/current readback and `ACTIVE` completion gate logic against controlled filesystem fixtures;
6. TGserver HTTP search adapter;
7. ast-grep deterministic structural analyzer and exporter projection;
8. Granite Debug Controller with strict bounded output;
9. DebugAI MCP adapter for `analyze` / `verify` only;
10. Astera QCE adapter;
11. exact Git repository intake and incremental diff states;
12. generic exact-revision Repository Asset Candidate assessment/materialization;
13. exact Git tree/blob symlink/type protections;
14. strict exporter provenance gates (`HEAD` match + clean Working Tree);
15. source/CI regression coverage preserving the current 80-Asset baseline.

Intentionally unavailable or still unproven:

1. direct Astera Evidence Search until a sanctioned ModuleCatalog caller contract exists;
2. real Server-to-Master-PC transport bridge;
3. real KB `ACTIVE` E2E using that bridge;
4. Production/Deploy/Main merge state, which remains outside source completion and requires explicit approval.

No extra workflow platform, second AI router, second debug engine, or automatic patch/apply path is needed to close these remaining boundaries.

## 18. Completion criteria

Factory v1 is not complete merely because code builds, a Candidate materializes, a bundle is copied, or a KB intake is `ACCEPTED`.

Minimum completion evidence:

- current registered assets still validate and regressions pass;
- generic repository Candidate assessment retains exact revision identity and refuses missing required evidence;
- Candidate materialization uses exact committed Git objects, excludes mutable Working Tree bytes, and rejects Git symlinks;
- `READY_FOR_ADMISSION` remains separate from explicit Catalog registration;
- exported `asset.json` files actually validate against the JSON Schema;
- deterministic repeat export remains byte-stable where expected;
- explicit Catalog revision does not differ from checked-out HEAD;
- dirty Catalog Working Tree cannot be exported under a clean commit identity;
- optional README absence does not break an otherwise valid registered Asset/export;
- delivery preflight verifies manifest/count/hash identity;
- incomplete transport is never visible as a completed `ready` delivery;
- a second completed ready delivery is refused in v1;
- same-commit/same-hash active delivery is idempotent;
- same-commit/different-hash delivery is rejected;
- Repository + TGserver intake works against representative controlled data;
- structural extraction is deterministic for supported fixtures;
- contradiction fixture routes through a valid Granite decision to the correct DebugAI MCP action;
- invalid Granite output is rejected;
- no patch/apply mutation path exists;
- QCE preserves unavailable/rejected states without false PASS;
- unavailable direct Evidence Search is reported explicitly rather than impersonating `astera-main`;
- real KB delivery verifies matching `ACTIVE` receipt and Current authority for the delivered commit;
- changed and unchanged states are both verified;
- existing Catalog behavior required by the new design has no unintended regression;
- GitHub revision, Server runtime, KB `ACCEPTED`, and KB `ACTIVE` are reported separately.
