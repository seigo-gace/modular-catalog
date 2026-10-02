# ModuleCatalog ↔ TGserver Boundary

Status: Current integration boundary
Date: 2026-10-03 JST
ModuleCatalog branch: `feat/reusable-knowledge-factory-v1-20261002`
Legacy TGserver usage: KEEP AS-IS
New TGS vNext: SEPARATE SYSTEM / NO MIGRATION ASSUMPTION

## 1. Decision

ModuleCatalog continues to use the existing TGserver path and the original TGserver Group prepared for this purpose.

The new TGS vNext is being built separately. ModuleCatalog does not migrate to it as part of the current Factory v1 work and does not wait for it before continuing.

The existing TGserver integration remains the runtime-observation source for ModuleCatalog. The existing Group remains the operational destination/source boundary for this integration unless Master explicitly changes that decision later.

## 2. Fixed separation

### Existing TGserver used by ModuleCatalog

ModuleCatalog keeps using the current compatibility HTTP API and existing operational Group.

Current adapter contract:

```text
POST /search
query
project_id
severity
from
to
```

ModuleCatalog continues to:

- call existing TGserver only through its current HTTP API;
- use the original existing TGserver Group already prepared for this purpose;
- treat returned records as observed runtime evidence;
- keep Repository facts and TGserver observations separate;
- preserve missing runtime facts as UNKNOWN / NOT_RECORDED;
- avoid direct Telegram / Redis / Meilisearch access.

No new TGserver Group, vNext topology, Provider/Bot Pool, PostgreSQL Routing Registry, or vNext Runtime dependency is required for ModuleCatalog Factory v1.

### New TGS vNext

New TGS vNext is a separate development/runtime track.

Its Operation Ledger, Provider Receipt, Reconciliation, Routing Registry, Provider/Bot/Group scheduling, Group Catalog, new Telegram topology, Object Storage, and future `/v1` APIs are not ModuleCatalog Factory v1 dependencies.

ModuleCatalog must not duplicate those mechanisms internally, but it also must not automatically migrate to them.

Any future connection to new TGS vNext requires a new explicit Master decision. There is no implicit migration plan.

## 3. ModuleCatalog responsibilities

ModuleCatalog owns:

- exact Git revision intake;
- repository fact/provenance collection;
- runtime evidence intake through the existing TGserver adapter;
- deterministic structural extraction;
- reusable asset / Knowledge Unit / Case / Relationship construction;
- Canonical / Deterministic Derived / AI Derived / UNKNOWN separation;
- Module Architecture and reusable-quality gates;
- DebugAI/Astera escalation under explicit contracts;
- `gace.reusable-asset.v1` snapshot creation;
- GPT final review and APPROVE / HOLD / REJECT;
- approved KB admission initiation and matching KB ACTIVE readback.

## 4. Existing TGserver evidence rules

TGserver runtime observations are evidence, not Repository Canonical facts.

```text
Repository = what is implemented / declared
TGserver   = what was observed at runtime
```

Neither source silently overwrites the other.

Contradiction may trigger verification/debug analysis, but ModuleCatalog does not invent missing facts or reinterpret absence as proof of failure.

## 5. No duplicate reliability stack

ModuleCatalog must not add its own generic versions of:

- Telegram retry infrastructure;
- provider acknowledgement recovery;
- generic Provider/Bot/Group scheduling;
- route/topic lifecycle management;
- generic operation ledger;
- generic DLQ;
- generic reconciliation worker;
- Telegram object replication/self-heal;
- generic Meili search authority.

Those are TGserver/TGS responsibilities, not reusable-asset semantic processing responsibilities.

## 6. KB transport remains unchanged

ModuleCatalog Factory v1 keeps the existing transport:

```text
Server sealed outbox
  -> Master-PC initiated pull
  -> F:\G-ACE-KB ready boundary
  -> KB processing
  -> ACCEPTED
  -> ACTIVE
  -> processed
  -> Deep Health
```

New TGS vNext Object Storage is not part of this path.

Do not replace the current KB transport with new TGS vNext unless Master explicitly directs a separate migration later.

## 7. Processing roles

```text
Repository facts --------------------+
                                      |
existing TGserver runtime evidence ---+--> ModuleCatalog Factory
                                             |
                                  deterministic processing
                                             |
                                    reusable asset data
                                             |
                                    machine quality gates
                                             |
                                      GPT final review
                                             |
                               APPROVE / HOLD / REJECT
                                             |
                                  approved KB admission
```

## 8. Current verdict

- Existing ModuleCatalog `/search` adapter: KEEP AS-IS.
- Existing original TGserver Group for ModuleCatalog: KEEP USING.
- New TGS vNext dependency for ModuleCatalog Factory v1: NO.
- Automatic migration from existing TGserver to new TGS vNext: NO.
- Direct TGserver DB/Telegram/Meili access from ModuleCatalog: FORBIDDEN.
- Duplicate TGserver/TGS reliability/routing/reconciliation logic inside ModuleCatalog: FORBIDDEN.
- Current Server-outbox -> Master-PC pull -> KB transport: KEEP.
- Future new-TGS integration: only by separate explicit Master instruction.
