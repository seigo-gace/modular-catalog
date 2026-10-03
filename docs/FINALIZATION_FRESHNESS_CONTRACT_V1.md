# ModuleCatalog Finalization Freshness Contract v1

## Purpose

The final Catalog→KB path must only consume reusable data generated from the **current completed ModuleCatalog finalization HEAD**. A previously reviewed, approved, sealed, or ACTIVE-capable snapshot becomes historical evidence as soon as the authoritative finalization branch advances.

This prevents a valid-but-old snapshot from being mistaken for the data produced by the completed Catalog.

## Authority

- Repository: `seigo-gace/modular-catalog`
- Finalization branch: `feat/reusable-knowledge-factory-v1-20261002`
- Final data identity: exact 40-character Catalog commit plus exact top-level manifest SHA-256.
- Historical Factory results, GPT reviews, admission tickets, runtime receipts, and outbox directories are retained as evidence; they are not rewritten to look current.

## Required order

```text
complete ModuleCatalog source
-> freeze exact current finalization HEAD
-> create a new Factory request for that exact HEAD
-> generate a fresh full reusable snapshot
-> run machine gates and portable-reuse verification
-> GPT final review of that fresh identity
-> admission only while reviewed commit is still current HEAD
-> runtime seal only while ticket commit is still current HEAD
-> Master-PC pull only while Contabo checkout is the finalization branch at that exact HEAD
-> KB acceptance / indexing / Current activation / health
-> same-identity readback
```

If ModuleCatalog source advances at any point before the final KB run completes, the old snapshot is `STALE_FOR_FINALIZATION`. A new Factory request and fresh review are required. Old evidence may still be used for regression diagnosis, but not for final completion.

## Fail-closed gates

### Factory generation

`chat-factory-process.yml` resolves the live finalization branch with `git ls-remote` and requires the request `catalog_commit` to equal that HEAD before checking out or exporting data.

### GPT admission

`chat-kb-admission.yml` validates the Factory result and re-resolves the live finalization branch. A review cannot create a runtime admission ticket if its result commit is no longer current.

### Runtime admission / Contabo seal

`runtime-admission-queue.js` reads the live finalization branch through GitHub and requires the ticket commit to equal the current HEAD **before** accepting an existing idempotent outbox or building a new seal. Therefore an old sealed outbox cannot become current merely because its hash still matches an old approval.

### Master-PC pull

`pull-modulecatalog-kb-delivery-windows.ps1` reads the Contabo ModuleCatalog checkout branch and exact HEAD before the outbox manifest or SCP path is used. The checkout must be the fixed finalization branch and its HEAD must equal the requested Catalog commit. Manifest SHA-256 binding remains mandatory in addition to this freshness gate.

## Completion boundary

Catalog Source/CI passing is not the final KB proof. Final completion requires a **new** snapshot generated from the stable completed exact HEAD and real KB same-identity ACTIVE/readback evidence. Conversely, KB data from a prior Catalog generation must never be used as the authority for deciding whether the newer Catalog source is complete.
