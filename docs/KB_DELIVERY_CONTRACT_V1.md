# ModuleCatalog -> G-ACE KB Delivery Contract v1

Status: implementation authority for the Factory delivery boundary
Producer: `seigo-gace/modular-catalog`
Consumer: `seigo-gace/gace-dev-kb`
Format: `gace.reusable-asset.v1`

## 1. Responsibility boundary

ModuleCatalog owns reusable-asset creation, verification, KB-ready data generation, transport, and producer-side readback of the delivery result.

G-ACE KB owns the consumer path after a complete delivery becomes visible at the inbox boundary: admission, local searchable projection, BM25 / Vector / Knowledge Graph integration, MCP verification, Current switch/rollback, and continuing health checks.

ModuleCatalog does not clone/fetch the KB runtime, does not rebuild KB indexes, and does not mutate KB-owned `processing`, `processed`, `failed`, Current, receipt, runtime-state, or lock files.

`ACTIVE` readback is an end-to-end verification condition for the delivered commit; it does not transfer KB runtime ownership to ModuleCatalog.

## 2. Current consumer authority

This contract was checked against the current KB implementation on branch:

```text
repository = seigo-gace/gace-dev-kb
branch     = feat/reusable-asset-kb-schema-20261001
```

Relevant consumer authorities:

```text
docs/MODULECATALOG_KB_INTAKE_RUNTIME.md
docs/REUSABLE_ASSET_KB_CONTRACT.md
scripts/process-modulecatalog-inbox-windows.ps1
scripts/receive-modulecatalog-kbdata-windows.ps1
scripts/accept_modulecatalog_delivery.py
scripts/activate-modulecatalog-accepted-windows.ps1
scripts/check-modulecatalog-kb-runtime-windows.ps1
```

The producer must follow the executable consumer contract rather than infer new behavior from directory names or commit timestamps.

## 3. Delivery layout

The producer delivers exactly the current reusable asset bundle structure:

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

A full activation candidate represents one complete intended ModuleCatalog snapshot. Incremental producer processing may avoid rebuilding unchanged assets, but the activation delivery is still a full snapshot unless producer and consumer are explicitly versioned to another contract later.

## 4. Standard inbox

Current Windows inbox root:

```text
F:\G-ACE-KB\data\knowledge-inbox\modulecatalog\
├─ ready\
├─ processing\
├─ processed\
└─ failed\
```

A complete candidate is published at:

```text
ready\<delivery-id>\
```

Factory v1 uses the exact 40-character Catalog commit as `delivery-id`.

A directory without top-level `manifest.json` is incomplete/pending and is not a complete consumer candidate.

## 5. Atomic publish

ModuleCatalog must never copy a partially constructed delivery directly into `ready`.

Producer algorithm:

```text
1. export/build outside the KB inbox
2. run producer preflight against the completed bundle
3. create a target-filesystem temporary directory outside ready visibility
4. copy the completed bundle into that temporary directory
5. run the same preflight against the target-side copy
6. confirm the v1 delivery slot is safe
7. atomically rename/move the target-side temporary directory to ready/<catalog-commit>
8. re-read ready/<catalog-commit>/manifest.json and verify the exact identity
```

The final rename must occur on the target filesystem. A cross-filesystem rename is not treated as an atomic publish mechanism.

## 6. Single activation candidate policy

The current consumer has no monotonic producer sequence/predecessor authority. It intentionally refuses to decide which of multiple complete ready deliveries is newer.

Factory v1 therefore does not add `sequence`, generation numbers, commit-time ordering, or an inferred `supersedes` chain.

Producer precondition before a new inbox publish:

```text
complete ready candidates = 0
processing deliveries     = 0
```

If a complete `ready` candidate already exists, producer returns `KB_READY_OCCUPIED`.

If `processing` already contains a delivery, producer returns `KB_RECEIVER_BUSY` and does not queue the next activation candidate.

The producer does not sort delivery directories, Git timestamps, or receipt timestamps to infer ordering.

## 7. Consumer locks

Two current KB lock boundaries exist:

```text
F:\G-ACE-KB\data\knowledge-inbox\modulecatalog\processor.lock
F:\G-ACE-KB\data\knowledge-intake\modulecatalog\receive.lock
```

`processor.lock` serializes default inbox processing.
`receive.lock` serializes receive/activation runtime mutation.

ModuleCatalog does not create, delete, steal, or repair these locks. The inbox/receiver owns them.

The producer uses visible inbox state for publish preflight and treats consumer busy/error responses as fail-closed states. Stale-lock recovery remains a KB responsibility.

## 8. Producer preflight must mirror consumer admission invariants

Before publish, the producer validates at least the same portable conditions already enforced by the KB importer:

### Top-level manifest

```text
schema_version = 1
format = gace.reusable-asset.v1
catalog.repository = seigo-gace/modular-catalog
catalog.commit = exact 40-character commit
assetCount = assets.length
Asset IDs are non-empty and unique
assets/ directory set exactly matches declared Asset IDs
```

### Per-Asset manifest

```text
schema_version = 1
format = gace.reusable-asset.v1
algorithm = sha256
asset_id matches directory/id
catalog repository/commit/asset_path match
source_asset_hash matches top-level assetHash
bundle_hash matches top-level bundleHash
required files exist
manifested sizes/hashes match bytes
recomputed bundle hash matches
```

Required manifested files:

```text
asset.json
knowledge-units.jsonl
relationships.jsonl
cases.jsonl
```

### Asset/KU/Case/Relationship

Producer also checks:

```text
asset.json passes Reusable Asset Schema v1
verification.status = verified
Catalog provenance matches delivery commit/id/path
per-Asset KU/relationship/case counts match top-level declarations
Knowledge IDs are globally unique
parent_asset_id is correct
Case IDs are unique per Asset
Relationship IDs are globally unique
Relationship endpoints resolve to a declared Asset or Knowledge Unit
```

The consumer still re-verifies all of this. Producer preflight reduces avoidable failed deliveries; it does not replace KB admission.

## 9. Receipt schema actually consumed by the KB

Receipt path:

```text
F:\G-ACE-KB\data\knowledge-intake\modulecatalog\receipts\<catalog-commit>.json
```

Current acceptance/activation code writes and consumes these exact fields:

```text
schemaVersion
status
catalogRepository
catalogCommit
assetCount
knowledgeUnitCount
relationshipCount
caseCount
corpusCount
deliveryManifestSha256
knowledgeRecordsSha256
knowledgeMetadataSha256
acceptedRoot
acceptedAtUtc / activatedAtUtc
```

ACTIVE state may additionally include current-runtime fields such as:

```text
totalFormalRecordCount
formalKbSha256
backupFormal
backupSearch
```

ModuleCatalog final verification must not require optional/internal fields that are not part of its delivery identity.

## 10. Current authority

The current active ModuleCatalog snapshot authority is:

```text
F:\G-ACE-KB\data\knowledge-records\modulecatalog-reusable-active.json
```

The activation code also writes the same active state to the current reusable snapshot `runtime-state.json`.

A historical receipt whose status is `ACTIVE` is insufficient by itself. Final producer verification requires the Current activation marker to report the same Catalog commit.

This prevents a previously active old delivery from being treated as current merely because its old receipt still exists.

## 11. Completion state

Producer-visible state progression:

```text
BUILT
-> PREFLIGHT_VALID
-> PUBLISHED
-> ACCEPTED
-> ACTIVE
-> COMPLETE
```

ModuleCatalog reports `COMPLETE` only when the delivered identity matches the current KB authority.

Minimum ACTIVE verification:

```text
receipt.status = ACTIVE
receipt.catalogRepository = seigo-gace/modular-catalog
receipt.catalogCommit = delivered commit
receipt.deliveryManifestSha256 = SHA-256 of delivered top-level manifest
receipt asset/KU/relationship/case counts = delivered manifest counts
current marker.status = ACTIVE
current marker.catalogCommit = delivered commit
current marker.deliveryManifestSha256 = same delivered manifest hash
current marker counts = delivered manifest counts
```

When inbox operation is used, successful consumer processing also moves the delivery to `processed`; this is consumer archive state, not the producer's Current authority.

## 12. Idempotency / replay

### Same commit + same manifest + currently ACTIVE

Return idempotent success. Do not republish.

### Same commit + different manifest hash

Fail closed:

```text
KB_DELIVERY_IDENTITY_CONFLICT
```

### Historical ACTIVE receipt but different current marker

Do not republish the old commit as a normal retry. Return a stale/replay refusal state such as:

```text
KB_STALE_REDELIVERY_REJECTED
```

The KB receiver independently enforces this as `PREVIOUSLY_ACTIVE_DELIVERY_IS_NOT_CURRENT` if such a delivery reaches it.

### Existing ready/processing delivery

Do not create another activation candidate. Return the corresponding occupied/busy state.

### Failed delivery

A failed bundle is owned by the KB under `failed`. ModuleCatalog does not delete or mutate it.

The same commit may be rebuilt/revalidated and republished only when:

- no matching Current is already active;
- `ready` and `processing` are clear for a new candidate;
- the new producer bundle passes preflight;
- the same commit still has the same expected delivery identity, or a changed identity is explicitly treated as conflict rather than silently replacing it.

## 13. Consumer result separation

`ACCEPTED` means the transported payload passed admission and local projection was created.

`ACTIVE` means the existing KB runtime gates completed, the current snapshot switched successfully, post-cutover MCP verification passed, and active authority was written.

ModuleCatalog may observe these states but does not implement or duplicate the KB operations that produce them.

## 14. Health responsibility

Continuous health verification such as `check-modulecatalog-kb-runtime-windows.ps1` and its `-Deep` MCP checks belongs to G-ACE KB.

Factory v1 needs a matching `ACTIVE` receipt/current marker to prove its delivery completed end-to-end. It does not become the owner of ongoing KB health monitoring.

## 15. Cross-host boundary

The target is currently a Master-PC filesystem. A Server-hosted ModuleCatalog must not assume direct access to `F:`.

Factory code therefore separates:

```text
bundle generation / preflight
from
Delivery Adapter / bridge
```

The filesystem adapter is the executable reference implementation and test fixture. Real Server-to-PC transport is `NOT_CONFIGURED` until an existing or new verified bridge can provide:

- target-local temporary copy;
- atomic final rename;
- ready/processing state readback;
- receipt/current readback.

No unverified bridge is reported as available.
