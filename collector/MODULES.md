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
15 SelectionProfileBuilder
16 CompatibilityIndexer
17 SkillSelector
18 SkillCompositionPlanner
19 CatalogRegistrationAdapter
20 NotionLedgerAdapter
21 CheckpointRecorder
```

## Responsibilities

### 01 CategoryPlanLoader
Reads category IDs, search queries, provider scope and target counts from the selected Collection Config. Category names and quotas are not hard-coded into the selection layer.

### 02 ProviderRegistry
Provides GitHub, GitLab, npm, PyPI and crates.io search adapters. Provider failures are isolated and recorded.

### 03 CandidateQuotaSelector
Deduplicates candidates globally, ranks them and fills each configured category quota without counting the same source twice.

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

### 15 SelectionProfileBuilder
Converts every admission record into a selection contract containing capability domains, problem solved, input/output contracts, strengths, constraints, execution methods, dependencies, estimated speed/cost, quality, readiness and selection keywords. Each candidate receives `selection-profile.json`.

### 16 CompatibilityIndexer
Compares selection profiles and records complementary capability domains and compatible Skill IDs. It creates `results/selection-index.json` independently from the number of categories or candidates in the active Collection Config.

### 17 SkillSelector
Reads a task requirement and ranks only completed, Astera-admitted, selection-ready Skills. It applies capability, domain, category, execution method, quality, speed, cost and prohibited-constraint filters.

### 18 SkillCompositionPlanner
Creates an ordered reuse plan from ranked results. The first result is the primary Skill, complementary results are supporting Skills, and unrelated lower-ranked results remain alternatives. When no matching Skill exists, it returns `new-skill-or-no-existing-skill` rather than silently choosing an irrelevant asset.

### 19 CatalogRegistrationAdapter
Optionally calls the existing catalog CLI after admission. The Collector and Catalog never import each other.

### 20 NotionLedgerAdapter
Upserts only completed Astera-admitted and selection-ready Skills into the specified data source using Content Hash as the idempotency key. Search and comparison properties are synchronized with the code-side selection profile.

### 21 CheckpointRecorder
Appends every processed record or failure to `results/checkpoint.jsonl` so a long batch has durable evidence even if later candidates fail.

## Selection principle

A larger and more diverse Skill pool increases the available development choices. The system therefore follows this order:

```text
Task requirement
-> search existing selection profiles
-> compare capabilities, constraints, quality, speed and cost
-> select and compose reusable Skills
-> execute through their contracts
-> develop a new Skill only when no suitable existing Skill is found
```

Commercial-use eligibility is metadata and a gate for actual reuse; it is not a rule that narrows discovery to only commercially labeled repositories.

## Execution boundary

The modules are internal Python APIs and CLI components. They are not deployed as an HTTP service. Execution is limited to an AI-assistant-controlled runtime or a manually authorized GitHub Actions workflow. Astera is always called through its Skill APIs.
