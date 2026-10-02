# ModuleCatalog ↔ TGserver vNext Alignment

Status: Current integration boundary
Date: 2026-10-03 JST
ModuleCatalog branch: `feat/reusable-knowledge-factory-v1-20261002`
TGserver comparison authority: PR #8 `feat/tgserver-vnext-capability-20261002`
TGserver exact head reviewed: `07f8600e9c1c0cbfef975dd9684da8459975658c`

## 1. Decision

TGserver vNext and ModuleCatalog must remain separate systems with complementary responsibilities.

TGserver owns durable runtime evidence transport/state. ModuleCatalog owns semantic reusable-asset processing and admission preparation.

ModuleCatalog must not duplicate TGserver vNext routing, provider scheduling, durable operation state, reconciliation, retry/DLQ, locator authority, Telegram transport, or rebuildable search implementation.

TGserver must not own ModuleCatalog-specific reusable-asset semantics, Knowledge Unit/Case construction, Module Architecture admission judgment, Canonical/Derived classification, or GPT final review.

## 2. TGserver vNext Current responsibilities relevant to ModuleCatalog

Current TGserver vNext architecture owns or is implementing:

- durable Operation Ledger and idempotency;
- Telegram-first commit semantics;
- durable Provider Receipt evidence;
- reconciliation of ambiguous/provider-crash states;
- durable Routing Registry;
- Group/Topic/Generation placement;
- Provider/Bot/Group scheduling and backpressure;
- stable Group Catalog and isolated vNext topology;
- durable Telegram locator management;
- rebuildable Meilisearch indexing;
- generic Event/Object/Search APIs and future `/v1` surface;
- generic audit/repair/health/metrics.

TGserver explicitly does not own Consumer-specific business semantics or AI semantic decision making.

## 3. ModuleCatalog Current responsibilities

ModuleCatalog owns:

- exact Git revision intake;
- repository fact/provenance collection;
- runtime evidence intake through a TGserver adapter;
- deterministic structural extraction;
- reusable asset / Knowledge Unit / Case / Relationship construction;
- Canonical / Deterministic Derived / AI Derived / UNKNOWN separation;
- Module Architecture and reusable-quality gates;
- DebugAI/Astera escalation under explicit contracts;
- `gace.reusable-asset.v1` snapshot creation;
- GPT final review and APPROVE / HOLD / REJECT;
- approved KB admission initiation and matching KB ACTIVE readback.

## 4. Current TGserver adapter contract

The implemented ModuleCatalog adapter remains the existing TGserver compatibility API:

```text
POST /search
query
project_id
severity
from
to
```

This remains valid because TGserver vNext preserves existing endpoints as compatibility contracts until migration is explicitly approved.

The current ModuleCatalog adapter must continue to:

- call TGserver only through its HTTP API;
- never read Telegram, Redis, PostgreSQL, Provider Receipt Store, Routing Registry, or Meilisearch directly;
- treat TGserver results as observed runtime evidence, not Canonical repository facts;
- preserve missing or unavailable runtime facts as UNKNOWN/NOT_RECORDED rather than infer them.

## 5. vNext migration boundary

Do not invent or pre-implement a guessed `/v1` TGserver contract.

ModuleCatalog may add a vNext evidence adapter only after TGserver has all of the following:

1. canonical `/v1` Native/Data/Search/Operation API contract fixed in TGserver source authority;
2. exact runtime implementation wired;
3. real Telegram vNext E2E verified;
4. durable PostgreSQL Control Store wired and verified;
5. failure/reconciliation drill verified;
6. Master-approved integration boundary.

Until then, ModuleCatalog uses the compatibility `/search` adapter.

## 6. Evidence identity after vNext activation

When the vNext API is verified, ModuleCatalog should prefer TGserver durable evidence identities over weak log-only references.

Candidate evidence material, only when exposed by the sanctioned TGserver API, includes:

- operation identity;
- payload/content hash;
- durable operation state;
- structured Telegram locator;
- provider receipt evidence;
- reconciliation status;
- route/namespace/stream identity;
- exact event/object timestamp and class.

ModuleCatalog stores these as provenance/evidence references. It does not become the authority for their lifecycle.

Absence of a Provider Receipt must not be interpreted by ModuleCatalog as proof that Telegram delivery did not occur; TGserver reconciliation owns that decision.

## 7. No duplicate reliability stack

ModuleCatalog must not add its own generic versions of:

- Telegram retry;
- ambiguous provider acknowledgement recovery;
- Provider/Bot/Group selection;
- route/topic rotation;
- operation ledger;
- DLQ;
- reconciliation worker;
- Telegram object replication/self-heal;
- generic Meili search authority.

If ModuleCatalog needs those capabilities, it consumes the sanctioned TGserver API result.

## 8. KB transport remains separate for v1

TGserver vNext Object Storage is not yet a replacement for the current ModuleCatalog Server-outbox → Master-PC pull → G-ACE KB intake path.

Current KB transport remains unchanged until TGserver Object/Manifest v2, Native API, real runtime E2E, recovery drill, and Master approval are complete.

A later design may evaluate TGserver as a durable delivery carrier for review snapshots or KB packages, but that is a separate measured migration and must not silently replace the current transport.

## 9. Processing roles

```text
Repository facts --------------------+
                                      |
TGserver observed runtime evidence ---+--> ModuleCatalog Factory
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

TGserver provides durable evidence/storage/delivery facts. ModuleCatalog performs reusable-asset semantic processing. GPT Chat remains the final review gate.

## 10. Current verdict

- Existing ModuleCatalog `/search` adapter: KEEP.
- Direct TGserver DB/Telegram/Meili access from ModuleCatalog: FORBIDDEN.
- Duplicate TGserver reliability/routing/reconciliation logic inside ModuleCatalog: FORBIDDEN.
- TGserver vNext durable evidence adapter: DEFER until canonical API + runtime E2E are verified.
- Current KB pull transport replacement by TGserver: NOT APPROVED / NOT IMPLEMENTED.
- Future TGserver durable operation/locator/receipt evidence use: RECOMMENDED after sanctioned API activation.
