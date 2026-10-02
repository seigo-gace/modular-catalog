# ModuleCatalog

ModuleCatalog is the internal reusable development-asset processing factory and canonical catalog for G-ACE development work.

The active Factory path is designed to turn exact repository facts plus observed runtime evidence into verified reusable asset data without fabricating missing facts, then deliver one complete `gace.reusable-asset.v1` snapshot to the G-ACE KB boundary.

## Current Factory boundary

```text
Git repository exact revision
+ TGserver runtime evidence
        ↓
Repository intake / Candidate assessment
        ↓
Canonical + deterministic structural extraction
        ↓
Knowledge Unit / Case / Relationship / metadata projection
        ↓
Granite Debug Controller when deterministic failure signals exist
        ↓
DebugAI MCP analyze / verify only
        ↓
optional supported Astera evaluation
        ↓
Ajv schema + integrity gates
        ↓
gace.reusable-asset.v1 full snapshot
        ↓
sealed Server outbox
        ↓
Master-PC initiated SSH/SCP pull
        ↓
F:\G-ACE-KB standard inbox
        ↓
existing KB receiver / BM25 / Vector / KG / MCP / ACTIVE
```

ModuleCatalog does not own or modify Astera v8, AI Core, DebugAI, TGserver, or the G-ACE KB runtime implementation. Those are external capabilities with separate authorities.

## Truth boundary

Produced information is separated into:

- Canonical: explicitly recorded authoritative facts;
- Deterministic Derived: repeatable projection from Canonical facts;
- AI Derived: AI interpretation with explicit derivation boundary;
- Unknown / Not Recorded: evidence is insufficient.

Missing facts are not filled merely to make an Asset appear complete.

## Module Architecture

The preserved logical architecture is:

```text
Part
  -> Feature
    -> Component
      -> System
        -> Application System
```

The five levels are logical responsibility/reuse levels and do not require a matching directory hierarchy.

## Active design authorities

- `docs/REUSABLE_KNOWLEDGE_FACTORY_V1.md`
- `docs/DESIGN_DELTA_FACTORY_V1.md`
- `docs/REPOSITORY_ASSET_CANDIDATE_V1.md`
- `docs/KB_DELIVERY_CONTRACT_V1.md`
- `docs/KB_PULL_TRANSPORT_V1.md`
- `schemas/reusable-asset-v1.schema.json`
- `schemas/debug-controller-v1.schema.json`

Historical ChatGPT-specific work-control material is not the Factory v1 design authority. Workspace operational authority is owned by `server-core` plus the current explicit task instructions.

## Minimal runtime dependencies

Factory v1 intentionally avoids a new workflow platform/database/AI router.

Current direct dependencies are:

- Node.js 22+
- Ajv — executable JSON Schema validation
- ast-grep — deterministic structural extraction; Tree-sitter is used through ast-grep
- MCP client — DebugAI stdio integration

Existing external capabilities are reused instead of duplicated:

- TGserver HTTP `/search`
- AI Core OpenAI-compatible Router API with Granite as the Debug Controller model
- DebugAI MCP
- Astera QCE API where its sanctioned caller contract exists
- G-ACE KB Windows receiver/runtime

Direct Astera Evidence Search is intentionally not connected because the current inspected route does not expose a sanctioned ModuleCatalog caller contract.

## Existing registered Asset commands

Search:

```bash
node src/cli.js search --query "text" --json
```

Show:

```bash
node src/cli.js show <asset-id> --section all --json
```

Validate:

```bash
node src/cli.js validate <asset-id> --json
```

Explicit registration remains the Canonical admission boundary:

```bash
node src/cli.js register <candidate-directory> --json
```

Build/verify index:

```bash
node src/cli.js build-index --json
node src/cli.js verify-index --json
```

## Generic repository Candidate boundary

Assess an exact external Git revision without registering it:

```bash
node src/cli.js repository-candidate \
  --repo <git-directory> \
  --revision <exact-40-char-sha> \
  --spec <candidate-spec.json> \
  --json
```

Materialize a validated Candidate outside the ModuleCatalog working tree:

```bash
node src/cli.js repository-candidate \
  --repo <git-directory> \
  --revision <exact-40-char-sha> \
  --spec <candidate-spec.json> \
  --output <external-candidate-directory> \
  --json
```

Candidate construction requires explicit Canonical metadata plus explicit file mappings for required Design / Logic / Architecture / Evidence / Source / Normal Test / User Test material. Missing material remains `INCOMPLETE`.

`READY_FOR_ADMISSION` does not mean registered. The existing `register` operation must still succeed before the Asset becomes Canonical Catalog state.

## Reusable Asset export

Export the complete registered Catalog:

```bash
node src/cli.js export-reusable-assets \
  --output <external-directory> \
  --catalog-commit <exact-current-head> \
  --json
```

Export one registered Asset for inspection/testing:

```bash
node src/cli.js export-reusable-assets <asset-id> \
  --output <external-directory> \
  --catalog-commit <exact-current-head> \
  --json
```

Export provenance is fail-closed:

- explicit Catalog commit must equal checked-out `HEAD`;
- Catalog Working Tree must be clean;
- output must be outside the Catalog working tree;
- same canonical input/revision remains deterministic.

KB activation itself requires a full current snapshot, not a single-Asset export.

## KB delivery preflight

Validate a completed full delivery before transport:

```bash
node src/cli.js preflight-kb-delivery <delivery-directory> --json
```

The producer preflight validates schema, provenance, per-file hashes, bundle hashes, counts, IDs, parent links and relationship targets. The KB independently revalidates the delivery after transport.

## Sealed Server outbox

Factory v1 prepares a transportable full snapshot in an existing Server outbox directory:

```bash
node src/cli.js prepare-kb-outbox \
  --outbox <existing-server-outbox-directory> \
  --json
```

The operation builds in an outbox-local temporary directory, runs full producer preflight, then atomically renames to:

```text
<outbox>/<exact-catalog-commit>/
```

Same commit + same manifest is idempotent. A conflicting existing identity fails closed.

The outbox is only a transport staging boundary. It is not KB Current authority.

## Master-PC pull transport

Cross-host Factory v1 uses the existing Windows SSH/SCP **client** surface and does not create a PC inbound server/service.

Source:

```text
scripts/pull-modulecatalog-kb-delivery-windows.ps1
```

It pulls one explicitly named Catalog commit from the sealed Server outbox into a temporary directory under the `F:\G-ACE-KB` inbox filesystem, validates the top-level transfer identity, then publishes by same-filesystem rename into the standard `ready\<catalog-commit>` location.

It then invokes the existing KB-owned inbox processor and existing Deep health check. ModuleCatalog does not duplicate KB admission, indexing, cutover, rollback or archive logic.

Real SSH/SCP connectivity, Server outbox execution, Master-PC pull and KB `ACTIVE` E2E remain runtime gates until actually executed.

## Filesystem delivery reference commands

For same-host controlled fixtures/reference behavior only:

```bash
node src/cli.js publish-kb-delivery <delivery-directory> \
  --kb-root <kb-root> \
  --json

node src/cli.js verify-kb-active <delivery-directory> \
  --kb-root <kb-root> \
  --json
```

A Server-hosted ModuleCatalog must not assume direct filesystem access to the Master PC `F:` drive. The real cross-host design is documented in `docs/KB_PULL_TRANSPORT_V1.md`.

## Source verification

```bash
npm test
npm run verify
npm run check
```

GitHub source/CI PASS is not Server runtime PASS, Master-PC transport PASS, or KB `ACTIVE` PASS. Those states must be reported separately.
