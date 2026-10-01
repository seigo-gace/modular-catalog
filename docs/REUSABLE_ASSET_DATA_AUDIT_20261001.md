# Reusable Asset Data Audit — 2026-10-01

## Scope

Target: `seigo-gace/modular-catalog` branch `feat/reusable-asset-schema-v1-20261001`.

Purpose: establish what the current Catalog can export as Canonical Data, what can be deterministically derived, what is not currently recorded, and what requires a future explicit contract or AI-derived layer.

## Current Catalog inventory

- Registered assets: 80
- `meta.json`: 80/80
- `README.md`: 80/80
- `design.md`: 80/80
- `logic.md`: 80/80
- `architecture.md`: 80/80
- `evidence.json`: 80/80
- `manifest.json`: 80/80
- `source/`: 80/80
- `tests/normal/`: 80/80
- `tests/user/`: 80/80
- Current source-file cardinality: 1 per asset
- Current normal-test-file cardinality: 1 per asset
- Current user-test-file cardinality: 1 per asset
- Catalog index: 80 unique entries
- Registered Asset validation: PASS
- Normal tests: 80/80 PASS
- User tests: 80/80 PASS

## Canonical Data already available

These fields can be exported without inventing information:

- Identity: `id`, `name`, `version`
- Discovery: `summary`, `purpose`, `responsibility`
- Classification: `layers`, `languages`, `runtimes`, `tags`
- Composition input: `dependencies`, `constraints`
- Provenance: `source.repository`, `source.commit`, catalog commit, asset path
- Verification: `evidence.normal`, `evidence.user`, `verifiedAt`
- Integrity: `manifest.algorithm`, `manifest.assetHash`, per-file SHA-256 records
- Implementation: source files and exact source contents
- Test assets: exact Normal/User test files and their paths
- Documentation: README, design, logic, architecture

## Deterministically derived by the Catalog exporter

- Search keywords from existing Meta + design/logic/architecture text
- `asset_kind=capability` only when the existing Meta explicitly contains the `skill` tag; otherwise `unknown`
- `mutation_authority=false` only when an existing constraint explicitly says there is no mutation authority; otherwise `null`
- Knowledge Units for overview, documentation, design, logic, architecture, evidence, code, and test source
- Test Case records preserve exact test source and recorded expected results; unextractable scenario/input/actual values remain `null`
- `contains` relationships between an Asset and its exported Knowledge Units
- `depends_on` relationships only when a declared dependency exactly matches another registered Asset ID

## Currently not recorded as Canonical Data

Repository search found no current canonical fields for:

- `assetKind`
- `use_when`
- `do_not_use_when`
- `capabilities`
- `semantic_terms`
- `recommended_before`
- `failure_conditions`
- `inputs` / `outputs`
- `side_effects`
- `mutation_authority`
- explicit Knowledge Unit IDs
- normalized test `case_id` / scenario / input / actual

These absences are not filled with guesses.

## Future Derived layer candidates

AI or another explicit analysis layer may derive the following, but those values must remain marked as Derived and must retain their source paths:

- applicability (`use_when`, `do_not_use_when`, `preconditions`, `required_context`, `failure_conditions`)
- capabilities and semantic terms
- normalized Input/Output contract descriptions when source evidence is sufficient
- normalized test scenarios and inputs
- related/complementary/alternative assets
- recommended ordering
- higher-level patterns and workflows

AI-derived values must never overwrite Canonical facts. Missing facts remain `unknown` / `not_recorded` until verified.

## Contract additions that would make data Canonical

To make the following facts authoritative rather than inferred, the Catalog Asset Contract would need explicit fields:

- `assetKind`
- explicit Input/Output contract
- explicit side-effect and mutation-authority declaration
- explicit applicability boundaries
- explicit lifecycle status and supersession
- explicit inter-asset relationships
- explicit normalized reusable test-case metadata

## Export boundary

The Catalog-side implementation now produces `gace.reusable-asset.v1` bundles. The bundle is a derived representation of the current Catalog and is intentionally generated outside the Catalog working tree.

The Catalog remains the Canonical source. The KB repository is not modified by this work.

## Verification boundary

All current Catalog verification remains required before export:

1. Asset validation and manifest integrity
2. Normal test evidence
3. User test evidence
4. Catalog index cardinality and uniqueness
5. Reusable Asset export test across all 80 assets

Current reusable export test result: 80 assets, 720 Knowledge Units, 160 test-case records, all passing.

## Non-goals in this Catalog-side phase

- No F:\\G-ACE-KB writes
- No `gace-dev-kb` changes
- No PC sync implementation
- No AI-derived semantic enrichment
- No replacement of Canonical Asset source with generated KB data
