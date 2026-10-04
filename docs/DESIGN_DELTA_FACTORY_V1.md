# Design Delta — Reusable Knowledge Factory v1

Status: Active design delta
Baseline preserved: `docs/ARCHITECTURE.md`
New design authority: `docs/REUSABLE_KNOWLEDGE_FACTORY_V1.md`
Repository candidate authority: `docs/REPOSITORY_ASSET_CANDIDATE_V1.md`
Delivery authority: `docs/KB_DELIVERY_CONTRACT_V1.md`
Cross-host transport authority: `docs/KB_PULL_TRANSPORT_V1.md`
TGserver ZERO integration authority: `docs/TGSERVER_ZERO_INTEGRATION.md`

## 1. Why this delta exists

The original Modular Catalog architecture was optimized for verified Asset storage, compact search, selective loading, and ChatGPT work-control assistance.

The current requirement changes the system responsibility from a searchable asset catalog into a reusable development-asset processing factory that:

```text
Repository + TGserver runtime evidence
-> process/normalize/verify
-> KB-ready reusable knowledge
-> verified KB delivery
```

The old architecture is preserved as historical baseline. It is not rewritten to pretend that the Factory responsibility always existed.

## 2. Preserved design

The following remains authoritative:

- `Part -> Feature -> Component -> System -> Application System` logical architecture;
- single-responsibility/reuse-first Module design;
- canonical Asset identity/version/source/test/evidence/manifest/hash;
- fail-closed validation;
- selective processing rather than loading every asset by default;
- Catalog as canonical source and generated indexes/exports as derived data.

## 3. Superseded responsibility

The following is no longer a primary ModuleCatalog responsibility:

- ChatGPT-specific work-control routing;
- custom-prompt-driven repository read order;
- old control sections as the workspace command authority.

Workspace/development authority is now provided by `server-core` and current project instructions.

Existing `CHATGPT_WORK_CONTROL.md`, `control/`, `prompts/`, `src/control.js`, and their tests are legacy implementation to be retired from the active Factory path. They are not used as design authority for Factory v1.

Their physical removal is an implementation cleanup and must not be mixed with Factory correctness unless removal is necessary for the active path.

## 4. New responsibility

ModuleCatalog now owns the processing boundary from source evidence to KB delivery:

- exact Git repository/revision intake;
- explicit generic-repository Candidate assessment/materialization without source mutation;
- preservation of the existing explicit Asset admission boundary (`register`) after Candidate validation;
- intake of sanitized TGserver ZERO central Reader evidence with exact repo/stream/project binding;
- deterministic structural extraction;
- Knowledge Unit / Case / Relationship / metadata construction;
- source-vs-runtime consistency checks;
- Granite-based DebugAI invocation decision;
- DebugAI MCP analyze/verify calls only;
- Astera API integration only where a sanctioned caller contract exists;
- executable schema/integrity gates;
- KB-ready bundle generation;
- atomic KB transport;
- producer-side readback of KB `ACCEPTED` / `ACTIVE` state and final matching Current authority.

Generic repository intake does not authorize Canonical invention. An external repository becomes a registration Candidate only from an exact commit plus an explicit Canonical declaration and explicit file-role mapping. Missing Design, Logic, Architecture, Evidence, Source, Normal Test, or User Test material remains incomplete; ModuleCatalog does not manufacture it.

KB internal indexing/search/runtime remains outside ModuleCatalog. `ACTIVE` readback is completion evidence for the delivery; it does not make ModuleCatalog the owner of KB indexing, Current cutover, rollback, or continuing health checks.

Exact producer/consumer delivery/readback behavior is defined in `docs/KB_DELIVERY_CONTRACT_V1.md`. The v1 cross-host implementation uses the narrower `docs/KB_PULL_TRANSPORT_V1.md` contract: the Server seals a complete revision-named outbox bundle and the Master PC pulls that exact bundle with its existing SSH/SCP client into a target-local temporary directory before atomic `ready` publish. ModuleCatalog does not create a PC inbound service and does not assume direct VPS access to `F:`.

## 5. Technology delta

### Not adopted

A dedicated workflow platform was considered but rejected for Factory v1.

Reason: the existing Node.js ModuleCatalog already owns the required sequential processing and adding another orchestrator would increase deployment, configuration, observability, and failure-surface work before it provides measurable value.

The same minimality decision applies to an internal analytical database and a second provenance framework.

### Adopted/reused

- existing Node.js 22 ModuleCatalog = Factory foundation;
- native Git object/tree commands = exact-revision repository Candidate bytes and symlink/type checks;
- Ajv = executable JSON Schema Draft 2020-12 validation;
- ast-grep = structural source analysis using its existing Tree-sitter foundation;
- existing AI Core Router API = Granite controller inference;
- existing DebugAI MCP = debugging execution;
- existing Astera APIs = optional evidence/evaluation only through supported caller contracts;
- TGserver ZERO central Reader in `seigo-gace/TGserver` = authenticated legacy `/search` execution and sanitized runtime-evidence Artifact; ModuleCatalog does not call `/search` directly;
- existing Windows OpenSSH client (`ssh.exe` / `scp.exe`) = cross-host delivery pull after live verification;
- existing G-ACE KB inbox processor and Deep health script = consumer-owned activation/archive/runtime gate.

SCIP remains an extension point for cross-file semantic indexing when a concrete language/source requires more than the deterministic v1 analyzer can provide. It is not a mandatory v1 dependency.

No Windows OpenSSH Server, SMB share, Syncthing, new upload API, new VPN dependency, or new transport daemon is introduced by Factory v1.

## 6. Compatibility

Factory v1 builds on the existing `Reusable Asset Schema v1` and bundle layout introduced on PR #4.

It must preserve:

- deterministic export;
- `asset.json`;
- `knowledge-units.jsonl`;
- `relationships.jsonl`;
- `cases.jsonl`;
- `manifest.json`;
- exact Catalog/source provenance;
- explicit unknown/not-recorded states;
- no fabricated canonical fields.

The Factory may enrich these records only when the derivation class and source evidence are retained.

The existing Asset admission contract does not require `README.md`. Factory export therefore treats README as optional and emits its Knowledge Unit only when a non-empty README is actually present; current 80-Asset behavior remains unchanged because those Assets already contain README files.

A materialized Repository Candidate remains outside ModuleCatalog and has no Manifest until the existing explicit registration operation succeeds. `READY_FOR_ADMISSION` must not be reported as `REGISTERED`, exported, or KB-active.

The KB consumer remains a single-current-snapshot runtime. Factory v1 therefore emits one complete activation candidate at a time and does not invent producer sequence/generation authority merely to queue multiple snapshots.

The pull transport keeps the same consumer contract: transfer occurs outside `ready`, final publish is a same-filesystem rename, and the existing KB processor remains responsible for `ready -> processing -> ACTIVE -> processed`.

## 7. Rollback boundary

The Factory is developed on a branch based on the current reusable-asset export branch. No main merge, deploy, production switch, source repository mutation, Astera modification, AI Core modification, DebugAI modification, TGserver modification, or KB runtime modification is part of this design delta.

Source implementation of the pull bridge is not runtime deployment. Real Server SSH availability, exact Server outbox, Master-PC pull, KB activation and Deep health remain separate runtime gates until executed on the intended systems.

## 8. TGserver ZERO central Reader migration

The earlier Factory v1 source contained a Project-local TGserver HTTP client that called legacy `/search` directly. That route is superseded by the Workspace-wide TGserver ZERO integration contract.

Current boundary:

```text
ModuleCatalog Source/Test/Verify
  -> owner-only GitHub Development Probe
  -> GitHub Job Log + bounded Artifact
  -> CHAT readback

ModuleCatalog Runtime/Server logs
  -> seigo-gace/TGserver central Reader
  -> Cloudflare Access + legacy /search inside TGserver owner boundary
  -> sanitized Artifact
  -> CHAT readback / optional Factory evidence intake
```

Consequences:

- ModuleCatalog does not hold Cloudflare Access or TGserver API secrets;
- ModuleCatalog does not call TGserver `/search` directly;
- `[DEV-PROBE]` Issue content cannot become arbitrary shell input;
- Factory runtime evidence accepts only the sanitized ZERO Artifact and requires explicit expected repository and stream;
- project ID comes from TGserver ZERO registry metadata and is never guessed or copied from another Project;
- TGserver vNext is not used;
- Source/Test/CI state and Runtime/TGserver state remain separate.

At the referenced TGserver ZERO Current Authority (`seigo-gace/TGserver@9282f3540f9bf47cfad7e7814da8fd7145d44bba`), ModuleCatalog is `UNREGISTERED`. That blocks real ModuleCatalog TGserver ZERO runtime search, but it does not block Source/Test/Verify Development Probe adoption. Formal ZERO registry/producer onboarding is a separate TGserver-owned change and no existing P-number may be reused.
