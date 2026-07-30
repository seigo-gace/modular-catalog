# Collector Modules

## Processing order

```text
01 CategoryPlanLoader
02 ProviderRegistry
03 CandidateQuotaSelector
04 SafeSourceAcquirer
05 MultiLanguageAnalyzer
06 ModularDecomposer
07 LogicBuilder
08 FiveLayerReconstructor
09 SkillArtifactBuilder
10 LocalSafetyGate
11 AsteraJudgmentAdapter
12 AsteraQualityEvaluator
13 AsteraDebugLoop
14 AdmissionGate
15 CatalogRegistrationAdapter
16 NotionLedgerAdapter
17 CheckpointRecorder
```

## Responsibilities

### 01 CategoryPlanLoader
Reads category IDs, search queries, provider scope and target counts. The current plan targets 250 unique candidates across 11 categories.

### 02 ProviderRegistry
Provides GitHub, GitLab, npm, PyPI and crates.io search adapters. Provider failures are isolated and recorded.

### 03 CandidateQuotaSelector
Deduplicates candidates globally, ranks them and fills each category quota without counting the same source twice.

### 04 SafeSourceAcquirer
Downloads archives without executing them. Rejects path traversal, links, devices, excessive files and excessive unpacked size.

### 05 MultiLanguageAnalyzer
Extracts languages, manifests, entry points, symbols, dependencies, tests, documents, architecture patterns, logic patterns, capabilities, license and risks.

### 06 ModularDecomposer
Splits an existing implementation into the smallest responsibility-bearing Parts.

### 07 LogicBuilder
When reusable code boundaries are unclear, builds Parts from extracted logic, input/output behavior and failure behavior.

### 08 FiveLayerReconstructor
Reconstructs every candidate as Part → Feature → Component → System → Application System and stores the hierarchy in `source/reconstruction.json`.

### 09 SkillArtifactBuilder
Creates a new independent `skill.md`, design, logic, architecture, contracts, provenance and evidence. It does not treat copied upstream code as the finished Skill.

### 10 LocalSafetyGate
Requires an acceptable imitation score, reusable license, no detected secret and a stable source hash.

### 11 AsteraJudgmentAdapter
Calls only `POST /v1/skill/process` and produces judgment material for the reconstructed Skill.

### 12 AsteraQualityEvaluator
Calls only `POST /v1/skill/evaluate` and reads Quality, Completion, Blocking and eligibility.

### 13 AsteraDebugLoop
When Quality or Completion is below 95, or Blocking is non-zero, returns the evaluation to Astera, creates a revision, updates Skill/Design/Logic/Architecture, and re-evaluates. The default maximum is three debug rounds.

### 14 AdmissionGate
Passes only `KB_ELIGIBLE`, evaluation complete, Quality ≥95, Completion ≥95 and Blocking=0. All uncertainty fails closed.

### 15 CatalogRegistrationAdapter
Optionally calls the existing catalog CLI after admission. The Collector and Catalog never import each other.

### 16 NotionLedgerAdapter
Upserts only completed Astera-admitted Skills into the specified data source using Content Hash as the idempotency key.

### 17 CheckpointRecorder
Appends every processed record or failure to `results/checkpoint.jsonl` so a long batch has durable evidence even if later candidates fail.

## Execution boundary

The modules are internal Python APIs and CLI components. They are not deployed as an HTTP service. Execution is limited to an AI-assistant-controlled runtime or the assistant-created GitHub run request workflow. Astera is always called through its Skill APIs.
