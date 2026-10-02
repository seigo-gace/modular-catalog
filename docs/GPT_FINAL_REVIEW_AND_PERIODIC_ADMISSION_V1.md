# GPT Final Review and Periodic KB Admission v1

Status: Active design authority
Project: ModuleCatalog
Scope owner: ModuleCatalog

## 1. Decision

ModuleCatalog does not continuously publish every mechanically valid reusable asset into the G-ACE KB.

The final admission boundary is a GPT Chat review performed after deterministic Factory validation and before an asset snapshot becomes eligible for periodic KB admission.

The operating model is:

```text
Repository / TGserver facts
-> exact revision intake
-> deterministic extraction
-> Canonical / Derived separation
-> Knowledge Unit / Case / Relationship construction
-> Normal/User test and evidence checks
-> Module Architecture compliance checks
-> schema / integrity / provenance gates
-> reusable asset snapshot
-> GPT Chat final review
-> GPT_APPROVED exact snapshot only
-> periodic KB admission
-> KB ACCEPTED
-> KB ACTIVE
-> processed
-> Deep Health
```

GPT Chat is a review gate, not a Canonical data generator.

## 2. Final-review purpose

The final review answers whether the exact generated snapshot is suitable to retain as a reusable development asset.

It must assess at minimum:

- whether the asset represents a real reusable responsibility rather than an arbitrary file fragment;
- whether the five-level Module Architecture mapping remains coherent: Part -> Feature -> Component -> System -> Application System;
- whether responsibility boundaries and dependency direction are consistent with the recorded design;
- whether Canonical, Deterministic Derived, AI Derived, UNKNOWN and NOT_RECORDED boundaries are preserved;
- whether source, design, logic, architecture, tests and evidence support the claimed reusable boundary;
- whether Normal Test and User Test evidence prove only what the asset claims;
- whether provenance, exact Git revision and hashes are internally consistent;
- whether applicability information is sufficient for safe reuse or remains explicitly unknown;
- whether known-unverified boundaries are clearly retained;
- whether the asset is useful enough to justify KB retention and retrieval.

The reviewer must not invent missing facts to make an asset pass.

## 3. Review result states

The final review has exactly three decision states:

```text
GPT_APPROVED
GPT_REJECTED
GPT_HOLD
```

### GPT_APPROVED

The exact snapshot may enter the periodic KB-admission set.

### GPT_REJECTED

The snapshot must not enter the KB admission set. The reason must be recorded against the reviewed snapshot.

### GPT_HOLD

Evidence is insufficient or a required verification boundary is incomplete. The snapshot remains outside the KB admission set until a later exact snapshot is reviewed again.

## 4. Approval identity

Approval is immutable with respect to the reviewed bytes.

Every approval record must bind at minimum:

- ModuleCatalog repository;
- exact Catalog commit;
- delivery or snapshot manifest SHA-256;
- reviewed asset IDs or explicit full-snapshot scope;
- review-rule version;
- review result;
- review findings / blocking reasons;
- review timestamp.

Approval by branch name, tag, `latest`, or mutable `HEAD` is invalid.

If the Catalog commit, manifest hash, asset bytes, relevant test/evidence set, or review-rule version changes, the prior approval is not transferable. The changed snapshot returns to final-review-required state.

## 5. GPT review authority boundary

GPT Chat may:

- inspect recorded Canonical facts and traceable derived data;
- compare the generated asset against ModuleCatalog design authorities;
- inspect tests, evidence, provenance, hashes and known-unverified fields;
- identify contradictions, missing proof, over-claiming, weak applicability or architecture violations;
- return APPROVED, REJECTED or HOLD with evidence-bound reasons.

GPT Chat must not:

- fabricate Canonical metadata;
- silently convert interpretation into Canonical facts;
- modify source repository contents as part of the review decision;
- waive a failed schema, integrity, provenance, Normal Test or User Test gate;
- approve a different revision from the one actually reviewed;
- treat CI success alone as proof of real reuse success;
- mark an unknown reuse condition as known without evidence.

## 6. Periodic admission rule

Periodic admission consumes only exact snapshots with a valid `GPT_APPROVED` record.

The cadence is configurable operational policy and is intentionally not fixed by this design document.

A periodic run must:

1. enumerate snapshots approved since the previous successful admission boundary;
2. reject or skip snapshots whose exact approval identity no longer matches;
3. run the existing ModuleCatalog preflight and integrity gates again;
4. publish a complete sealed delivery only after all selected snapshots pass;
5. transfer through the existing Master-PC initiated transport boundary;
6. require KB `ACCEPTED` then matching `ACTIVE`;
7. require processed state and Deep Health before reporting completion;
8. leave unapproved, rejected and hold snapshots outside the delivery.

If there are no currently approved new snapshots, the periodic run is a no-op.

## 7. Automation boundary

Factory processing before the final GPT review should be automated as far as deterministic evidence allows.

The final GPT review remains an explicit review boundary. Periodic transport/admission after approval may be automated, but it must never bypass or synthesize approval.

No recurring unattended production admission is enabled merely by adding this design. The first real Server -> Master PC -> KB ACTIVE E2E, processed readback, Deep Health verification and rollback boundary must be proven before a recurring admission schedule is activated.

## 8. Reuse-quality boundary

A mechanically valid asset and a proven reusable asset are not the same claim.

The final GPT review must preserve this distinction:

```text
schema/integrity/provenance PASS
!=
real cross-project reuse proven
```

When cross-project reuse evidence is unavailable, the reviewer may approve retention only if the reusable boundary is otherwise well-supported and the unproven reuse boundary remains explicit. It must not relabel unproven reuse as proven.

Future reuse-result feedback may strengthen, deprecate, supersede or reject an asset, but it does not rewrite historical Canonical evidence.

## 9. Completion rule

For one reviewed periodic batch, completion requires all of the following:

```text
GPT_FINAL_REVIEW=APPROVED
EXACT_APPROVAL_IDENTITY=MATCH
MODULECATALOG_PREFLIGHT=PASS
SEALED_DELIVERY=PASS
KB_ACCEPTED=PASS
KB_ACTIVE=PASS
PROCESSED=PASS
DEEP_HEALTH=PASS
```

Anything less remains incomplete and must not be reported as a completed periodic KB admission.

## 10. Five-level Module Architecture interpretation

The five allowed layer values are exactly:

```text
Part
Feature
Component
System
Application System
```

Each Asset must declare at least one valid value and invalid layer names must fail mechanically.

A snapshot is **not** invalid merely because no retained Asset currently occupies one or more of the five layer levels. The Factory must not invent Feature/System/Application-System parent Assets or relationships only to make all five levels appear in a snapshot.

GPT final review evaluates whether the declared layer for each Asset is supported by its recorded responsibility/design and whether recorded dependencies contradict the architecture. Absence of a synthetic full Part -> Feature -> Component -> System -> Application System chain is not by itself a HOLD or REJECT reason.

## 11. Portable reuse smoke boundary

ModuleCatalog may prove an intermediate reuse boundary by copying every registered Asset outside the Catalog working tree and executing that copied Asset's recorded Normal/User Node test commands from the copied Asset root.

A PASS proves that the tested Asset package does not require its original Catalog filesystem location for those recorded behaviors. This evidence is recorded as `portable_reuse_smoke_proven=true`.

It does **not** prove integration into an unrelated real Project. Therefore:

```text
portable_reuse_smoke_proven=true
!=
real_cross_project_reuse_proven=true
```

The final GPT review must use both facts without promoting the portable smoke result into a stronger cross-project claim.
