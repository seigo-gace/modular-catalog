# Runtime Admission Worker v1

Status: Source implemented; Contabo placement/scheduling not yet activated

## Purpose

Bridge an exact `GPT_APPROVED` GitHub admission record to the existing ModuleCatalog Server outbox without giving GitHub a general-purpose runner or direct Master-PC access.

## Fixed path

```text
GPT Chat review
-> GitHub Factory result + GPT review + admission ticket
-> Contabo one-shot admission queue worker (read-only GitHub access)
-> exact approved Catalog commit temporary checkout
-> runtime revalidation of Factory result + GPT review + ticket
-> approved commit + manifest identity revalidation before seal
-> /home/admin1/logs/modulecatalog/outbox/<catalog-commit>
-> existing Master-PC initiated pull
-> F:\G-ACE-KB
```

## Fail-closed rules

- Only `GPT_APPROVED` + `READY_FOR_RUNTIME_ADMISSION` is accepted.
- Repository, transport, Server outbox root and KB root are fixed and cannot be redirected by a ticket.
- The runtime rebuilds the admission ticket from the Factory result and GPT review; a manually altered ticket is rejected.
- The exact temporary checkout HEAD must equal the approved Catalog commit and must be clean.
- The generated delivery manifest SHA-256 must equal the approved manifest before the revision directory is sealed.
- An existing revision directory is accepted only when its manifest identity matches; otherwise it is an identity conflict.
- GitHub access by this worker is read-only and limited to the fixed ModuleCatalog control branch paths.
- The worker does not push to the Master PC and does not create an inbound PC service.

## Source

- `src/runtime-admission.js`: ticket/evidence revalidation and exact seal boundary.
- `src/runtime-admission-queue.js`: fixed GitHub queue discovery, exact temporary checkout, idempotent one-shot processing and local receipt creation.
- `scripts/admit-approved-kb-ticket.mjs`: direct evidence-bundle admission entrypoint.
- `scripts/process-approved-admission-queue.mjs`: one-shot queue worker entrypoint.

## Runtime state boundary

Source/CI success does not mean the worker is installed or scheduled on Contabo. Persistent scheduling is a separate runtime/deploy action. Until that is explicitly activated and read back, the valid state is:

```text
RUNTIME_ADMISSION_WORKER_SOURCE=READY
CONTABO_WORKER_PLACED=NOT_VERIFIED
CONTABO_WORKER_SCHEDULED=NO
MASTER_PC_PERIODIC_PULL=NOT_VERIFIED
KB_ACTIVE_FOR_CURRENT_APPROVAL=NO
```
