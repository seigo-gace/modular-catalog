# Reusable Knowledge Factory v1

Status: Design baseline for implementation
Project: ModuleCatalog
Scope owner: ModuleCatalog

## 1. Purpose

ModuleCatalog is the canonical repository and processing factory for reusable development assets.

The Factory converts repository facts and TGserver runtime evidence into KB-ready reusable asset data, preserves provenance and uncertainty, validates the result, transports it to the G-ACE KB inbox, and does not claim completion until the KB reports the same Catalog commit as `ACTIVE`.

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

## 2. Fixed responsibility boundary

### ModuleCatalog owns

1. repository intake and exact revision identity;
2. TGserver log retrieval through its HTTP API;
3. canonical asset integrity verification;
4. deterministic structural extraction;
5. Knowledge Unit / Case / Relationship construction;
6. metadata and contract projection;
7. Canonical / Deterministic Derived / AI Derived / Unknown separation;
8. DebugAI invocation decision and evidence return handling;
9. optional Astera Evidence Search / Quality Completion evaluation through APIs;
10. schema and integrity gates;
11. deterministic `gace.reusable-asset.v1` bundle generation;
12. atomic transport to the KB `ready` boundary;
13. delivery retry/idempotency policy;
14. KB `ACCEPTED` / `ACTIVE` receipt readback;
15. end-to-end success only after the delivered Catalog commit is `ACTIVE`.

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
- README / Design / Logic / Architecture;
- explicit contracts and schemas;
- tests;
- evidence records;
- manifest/hash;
- Git revision and file paths.

An exact Git commit/revision is always retained in provenance.

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

Examples: explicit meta field, source path, test assertion, evidence result, Git commit, manifest hash.

### DETERMINISTIC_DERIVED

Produced by a repeatable rule from canonical input.

Examples: token/keyword projection, symbol list from structural analysis, exact dependency edge, normalized test-case identifier, file/content hash.

### AI_DERIVED

Produced by an AI interpretation and therefore never silently promoted to Canonical.

Factory v1 does not use AI merely to fill metadata gaps. AI use in v1 is limited to the Debug Controller. If an AI-derived field is introduced later, it must include exact derivation sources, model route, output contract, and verification state.

### UNKNOWN / NOT_RECORDED

Used when available evidence is insufficient.

The Factory never fabricates a canonical value to make the output look complete.

## 5. Minimal technology decision

Factory v1 intentionally avoids a new workflow platform or database.

### Foundation

Existing ModuleCatalog Node.js 22 codebase.

Reason: it already owns validation, asset scanning, hashing, export and tests. Introducing Kestra, Dagster, Temporal, or another orchestrator would duplicate responsibility and lengthen completion time.

### Adopt now

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
                         optional external verification
                           Astera Evidence Search API
                           Astera QCE API
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

- project_id;
- repository path/identifier;
- exact repository revision;
- optional asset_id filter;
- TGserver time window or cursor;
- output/delivery target contract.

No mutable `latest` reference is stored as provenance. The exact resolved revision is recorded.

### Stage 1: Intake

1. resolve exact repository revision;
2. enumerate selected asset/source files;
3. load declared metadata/docs/tests/evidence;
4. query TGserver by project_id and relevant time/severity boundaries;
5. redact/reject secrets according to existing Catalog safety rules;
6. attach source references, never raw secret material.

### Stage 2: Integrity

Existing Catalog manifest/hash validation is reused.

Failure is fail-closed for Canonical asset publication:

- missing required file;
- manifest mismatch;
- hash mismatch;
- symlink/path escape;
- duplicate identity;
- invalid revision identity.

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

### Stage 4: Knowledge construction

For each parent asset, construct only meaningful units from present source material:

- overview/discovery;
- design;
- logic;
- architecture;
- contract;
- code/symbol;
- test case;
- evidence;
- runtime observation/remediation when supported by evidence.

Every unit retains `parent_asset_id` and source references.

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
3. exact structural reference/call/import relation from deterministic analysis;
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

Astera is always an external service.

### Evidence Search

Used when a derived claim requires external evidence that repository/TGserver data cannot establish.

The adapter calls the supported Evidence Search API and preserves its exact result/status. Paid search is never enabled by ModuleCatalog.

### Quality Completion Evaluator

Used when a Factory artifact needs a quality/completion assessment against explicit requirements.

The adapter calls QCE `/v1/evaluate` or the sanctioned private route according to the deployed contract. ModuleCatalog does not import QCE internals.

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
9. output is reproducible for identical canonical inputs/revision and identical accepted external evidence set.

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

The Factory compares source identity and asset hash.

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

Factory states are explicit and machine-readable. Minimum states:

- `INPUT_INVALID`
- `REVISION_UNRESOLVED`
- `INTEGRITY_FAILED`
- `TGSEARCH_UNAVAILABLE`
- `STRUCTURAL_ANALYZER_UNAVAILABLE`
- `STRUCTURAL_EXTRACTION_FAILED`
- `DEBUG_NOT_REQUIRED`
- `DEBUG_CONTROLLER_INVALID_OUTPUT`
- `DEBUGAI_UNAVAILABLE`
- `DEBUGAI_FAILED`
- `ASTERA_EVIDENCE_UNAVAILABLE`
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
- Astera is used through APIs only.
- DebugAI is used through MCP only.
- AI Core is used through its Router API only.
- Source repositories are read-only to the Factory.
- Factory v1 has no automated source patch/apply capability.
- KB delivery is the only intended external write owned by this Factory.
- KB-owned processing/current/runtime state is read for verification but not mutated by ModuleCatalog.

## 17. Shortest implementation sequence

Implementation order is intentionally narrow:

1. fix the already-advertised `export-reusable-assets` CLI dispatch gap;
2. add executable JSON Schema validation and regression tests;
3. add deterministic delivery manifest/count/integrity preflight;
4. add filesystem Delivery Adapter with target-local temp + atomic rename + single-ready enforcement;
5. add KB receipt/current readback and `ACTIVE` completion gate;
6. introduce remaining Factory contracts/state model without changing current asset truth;
7. add TGserver HTTP search adapter;
8. add deterministic structural analyzer adapter using ast-grep;
9. add repository/TG consistency gate;
10. add Granite Debug Controller with strict output validation;
11. add DebugAI MCP adapter for `analyze` / `verify` only;
12. add optional Astera API adapters;
13. bind enriched Factory results to the existing exporter;
14. run source/CI regression;
15. separately verify the real server-to-PC transport/runtime only after the concrete bridge exists and required deployment/runtime approval is granted.

This order prioritizes the already-working producer/consumer contract and avoids building infrastructure before the Factory has a proven need for it.

## 18. Completion criteria

Factory v1 is not complete merely because code builds, a bundle is copied, or a KB intake is `ACCEPTED`.

Minimum completion evidence:

- current registered assets still validate and regressions pass;
- exported `asset.json` files actually validate against the JSON Schema;
- deterministic repeat export remains byte-stable where expected;
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
- Astera adapters preserve unavailable/rejected states without false PASS;
- real KB delivery verifies matching `ACTIVE` receipt and Current authority for the delivered commit;
- changed and unchanged states are both verified;
- existing Catalog behavior required by the new design has no unintended regression;
- GitHub revision, Server runtime, KB `ACCEPTED`, and KB `ACTIVE` are reported separately.
