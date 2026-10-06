# Reusable Asset + 5V Additive Contract v1

## Purpose

ModuleCatalog remains the canonical catalog/factory for reusable development assets. Reusable assets are not limited to code. They may include code, skill, tool, logic, architecture, design, contract, test, evidence, workflow, configuration, integration, or another explicitly recorded reusable asset type.

5V-RCCA is applied only to reusable assets that explicitly include the `code` type and have their own recorded verification evidence. It is not a replacement for the universal reusable-asset model.

## Non-destructive compatibility rule

The existing Reusable Asset v1 contract is retained.

- `schema_version` remains `1`.
- Existing identity/classification/discovery/applicability/contract/composition/implementation/verification/provenance/lifecycle/integrity/derivation fields remain unchanged.
- Existing `classification.layers` remains available as legacy/current catalog information.
- Existing asset IDs, source paths, test paths, manifests, relationships, and knowledge-unit kinds are not renamed or removed by this change.
- Existing assets without new metadata remain valid and are exported with an explicit `five_v.status=not_recorded` boundary.
- Legacy `layers` values MUST NOT be auto-promoted into verified 5V classification.

The additive field is `reusability`:

```json
{
  "reusability": {
    "asset_types": ["tool", "code"],
    "primary_type": "tool",
    "five_v": {
      "status": "verified",
      "applicable": true,
      "level": "Part",
      "composed_from": [],
      "verification_basis": ["tests/normal/...", "tests/user/..."]
    }
  }
}
```

## Universal reusable asset types

`meta.reusableAssetTypes` is optional canonical metadata. It is a non-empty string array when present. The Catalog does not restrict this to a closed enum because the reusable-asset universe can expand without schema replacement.

Examples include:

- `code`
- `skill`
- `tool`
- `logic`
- `architecture`
- `design`
- `contract`
- `test`
- `evidence`
- `workflow`
- `configuration`
- `integration`

An asset may have multiple types. A code-bearing tool may be `["tool", "code"]`; a pure design asset may be `["design"]`.

When `meta.reusableAssetTypes` is absent, the exporter preserves the existing primary `asset_kind` classification when known. It does not invent missing asset types.

## 5V applicability

`meta.fiveV` is optional canonical metadata.

If absent:

- `status=not_recorded`
- `applicable=null`
- `level=null`
- no composition is invented

If `applicable=false`:

- `status=not_applicable`
- `level` must be absent/null
- `composedFrom` must be empty

If `applicable=true`:

- `reusableAssetTypes` must include `code`
- exactly one level must be recorded from `Part`, `Feature`, `Component`, `System`, `Application System`
- normal and user verification evidence must both be PASS
- `verificationBasis` must be non-empty
- Feature and higher levels must record direct `composedFrom`
- Part cannot declare lower 5V children

## 5V composition invariants

For each `five_v_composed_from` edge:

- self-reference is forbidden
- referenced child must exist in the same Catalog export scope
- child must itself be verified 5V
- child level must be lower than parent level
- same-level and higher-level composition are fail-closed

Because level ordering is strict, a valid composition graph cannot contain a cycle.

`depends_on` and `five_v_composed_from` are different relations and MUST NOT be conflated.

## Knowledge / KB boundary

ModuleCatalog is the canonical producer of reusable-asset type and 5V facts.

G-ACE KB is a consumer/search projection. KB must not:

- infer 5V level from legacy layers
- promote unverified assets
- rewrite Catalog asset type
- create a second 5V graph engine

The existing generic relationship path can carry `five_v_composed_from`. KB changes, when required by fresh completed-Catalog data, should therefore be limited to preserving/searching the new additive fields and relationship.

## Migration rule for existing assets

Existing registered assets are not rewritten in bulk.

1. Keep current asset data intact.
2. Audit source/design/logic/architecture/tests/evidence.
3. Add `reusableAssetTypes` only when supported by evidence or explicit canonical metadata.
4. Add `fiveV` only for verified code-bearing assets.
5. Do not use legacy `layers` alone as 5V evidence.
6. Rebuild manifests only for assets whose canonical metadata is intentionally changed.
7. Run existing normal/user/portable-reuse gates after every migration batch.

## Final-data rule

Any previous Factory snapshot becomes historical as soon as Catalog source advances. Final KB E2E must use a fresh Factory result generated from the current exact Catalog HEAD after this additive contract and the audited asset metadata are complete.
