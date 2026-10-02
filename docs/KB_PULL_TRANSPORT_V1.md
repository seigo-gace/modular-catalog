# ModuleCatalog -> Master PC KB Pull Transport v1

Status: Source design + implementation; real Server/Master-PC runtime not yet verified
Owner: ModuleCatalog transport boundary
Consumer runtime owner: `seigo-gace/gace-dev-kb`

## 1. Decision

Factory v1 does **not** create a new inbound service on the Master PC.

The shortest supported cross-host design is:

```text
Server-hosted ModuleCatalog Factory
  -> seal one complete full-snapshot delivery in a Server outbox
  -> Master PC pulls that exact revision with its existing SSH/SCP client
  -> copy lands in a same-volume temporary directory under F:\G-ACE-KB inbox root
  -> verify top-level manifest identity against the Server manifest SHA-256
  -> atomic same-filesystem rename into ready\<catalog-commit>
  -> invoke the existing G-ACE KB inbox processor
  -> verify processed archive + ACTIVE receipt + Current authority
  -> invoke existing KB deep health check
```

This design intentionally avoids:

- Windows OpenSSH Server / inbound sshd creation;
- new SFTP daemon;
- SMB share creation;
- Syncthing or another synchronization service;
- a new public/private HTTP upload API;
- a required reverse VPS -> PC filesystem mount;
- a required WireGuard dependency.

WireGuard may carry the SSH route if it is already live and verified, but Factory v1 neither creates it nor assumes it exists.

## 2. Why PC-initiated pull

DebugAI MCP is currently a stdio integration around the existing Server-side DebugAI client/runtime boundary. TGserver, AI Core and Astera adapters are also naturally consumed from the Server processing environment.

Keeping the Factory on the Server avoids relocating those dependencies merely to solve file transport.

The Master PC already owns the target `F:\G-ACE-KB` filesystem. A PC-initiated pull means the target host performs the final filesystem operation itself, so the Server never needs direct access to `F:` and no inbound PC service is introduced by ModuleCatalog.

## 3. Producer outbox contract

Source implementation:

```text
src/kb-outbox.js
CLI: node src/cli.js prepare-kb-outbox --outbox <existing-server-directory> --json
```

The outbox directory must:

- already exist;
- be outside the ModuleCatalog working tree;
- be a real directory, not a symlink.

The operation:

1. requires the existing export provenance gates, including exact HEAD and clean Working Tree;
2. exports the complete current Catalog snapshot to a unique temporary directory inside the outbox filesystem;
3. executes the same producer delivery preflight;
4. names the final sealed directory with the exact Catalog commit;
5. atomically renames the validated temporary directory to `<outbox>/<catalog-commit>`;
6. re-runs preflight after the rename;
7. returns `SEALED` only after readback identity matches;
8. returns idempotent `SEALED` for the same commit/same manifest;
9. fails closed with `KB_OUTBOX_IDENTITY_CONFLICT` for an existing invalid/different delivery.

The Server outbox is a transport staging boundary, not the KB current authority. ModuleCatalog does not delete a sealed remote bundle automatically after activation; retention/cleanup remains a separate lifecycle decision.

## 4. Windows pull contract

Source implementation:

```text
scripts/pull-modulecatalog-kb-delivery-windows.ps1
```

Inputs are explicit:

```text
ServerHost
RemoteOutboxRoot
CatalogCommit (exact 40-character SHA)
Root (default F:\G-ACE-KB)
optional SSH port
```

The script uses only the existing Windows `ssh.exe` / `scp.exe` client surface. It uses `BatchMode=yes`, keeps normal host-key verification, and never enables or configures an inbound service.

The pull flow is:

```text
remote manifest SHA-256 readback through SSH
-> SCP exact <outbox>/<catalog-commit> into a unique local temporary directory
-> validate top-level format/repository/commit/cardinality
-> compare local manifest SHA-256 with remote manifest SHA-256
-> verify ready/processing state
-> same-filesystem Move-Item into ready\<catalog-commit>
-> re-read manifest hash
-> call existing process-modulecatalog-inbox-windows.ps1
-> require processed\<catalog-commit>
-> require matching ACTIVE receipt + Current marker + manifest identity
-> call existing check-modulecatalog-kb-runtime-windows.ps1 -Deep
-> PASS
```

The script also has state-aware resume/idempotency behavior:

- matching `processed` + ACTIVE/current identity -> no re-delivery, run Deep health and return idempotent PASS;
- matching `processing` -> invoke existing inbox processor to resume;
- matching `ready` -> invoke existing inbox processor;
- other processing/ready delivery -> fail closed;
- same commit with a different manifest identity -> fail closed.

## 5. Consumer ownership remains unchanged

The pull script does not implement KB acceptance, indexing, Knowledge Graph, MCP verification, cutover, rollback, receipt writing, or processed/failed archival.

Those remain owned by the current G-ACE KB scripts:

```text
process-modulecatalog-inbox-windows.ps1
receive-modulecatalog-kbdata-windows.ps1
activate-modulecatalog-accepted-windows.ps1
check-modulecatalog-kb-runtime-windows.ps1
```

The ModuleCatalog script only transports a complete immutable candidate to the standard inbox and invokes the existing consumer-owned entry/health commands.

## 6. Security boundary

The pull transport must not:

- enable Windows sshd;
- create firewall rules;
- create SMB shares;
- disable SSH host-key checking;
- copy secrets into arguments, logs, manifests or bundle data;
- infer the newest remote delivery by timestamp or directory ordering;
- delete the Server outbox after success;
- manipulate KB `processing`, `processed`, `failed`, receipt, Current, runtime-state or lock data directly.

The exact Catalog commit is always supplied explicitly.

## 7. Verification states

Source/CI verification and live transport verification are separate.

```text
OUTBOX_SOURCE=IMPLEMENTED
WINDOWS_PULL_SOURCE=IMPLEMENTED
WINDOWS_POWERSHELL_PARSE=CI_REQUIRED
OUTBOX_REGRESSION=CI_REQUIRED
EXISTING_80_ASSET_REGRESSION=CI_REQUIRED
REAL_SSH_CONNECTIVITY=NOT_VERIFIED
REAL_SERVER_OUTBOX=NOT_EXECUTED
REAL_MASTER_PC_PULL=NOT_EXECUTED
REAL_KB_ACTIVE_E2E=NOT_EXECUTED
```

No source/CI PASS is promoted to a live Server/PC transport PASS.

## 8. Live completion gate

The first real run is complete only when all of the following are observed on the intended current revisions:

```text
Server ModuleCatalog checkout exact + clean
Server outbox SEALED with exact Catalog commit
Master PC ssh/scp client can read that exact Server outbox
local transfer manifest hash == remote manifest hash
ready publish occurs only after transfer completion
existing KB processor returns ACTIVE
processed/<catalog-commit> exists
ACTIVE receipt identity matches delivery
Current marker identity matches delivery
check-modulecatalog-kb-runtime-windows.ps1 -Deep PASS
```

Until these are actually executed, transport/runtime status remains `NOT_VERIFIED` / `NOT_EXECUTED`.
