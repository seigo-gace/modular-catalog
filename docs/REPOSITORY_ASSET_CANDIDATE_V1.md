# Repository Asset Candidate Contract v1

Status: Active Factory v1 contract

This contract defines the boundary between an arbitrary Git repository and the existing ModuleCatalog Asset admission path.

It does **not** weaken `docs/ASSET_FORMAT.md`, does not register an Asset automatically, and does not let AI or deterministic analysis invent missing Canonical fields.

## 1. Purpose

A generic repository usually does not already use ModuleCatalog's physical Asset layout. The Factory therefore needs a staging boundary that can map explicit repository facts into a normal registration candidate without modifying the source repository.

```text
exact Git repository revision
+
explicit Canonical declaration
+
explicit repository file mapping
        |
        v
Repository Asset Candidate
        |
        +-- INCOMPLETE          -> stop, report missing evidence
        |
        +-- READY_TO_MATERIALIZE
                |
                v
validated candidate directory outside ModuleCatalog
                |
                v
READY_FOR_ADMISSION
                |
                +-- explicit existing `register` step only
```

`READY_FOR_ADMISSION` is not `REGISTERED`, not exported, not KB-ready, and not KB `ACTIVE`.

## 2. Source identity

The caller must provide an exact 40-character Git commit.

The Factory resolves that commit against the repository's actual Git object database. Mutable names such as `HEAD`, branch names, or tags are not accepted as revision identity for this boundary.

Candidate file bytes are read with Git from the exact revision. Uncommitted Working Tree changes are therefore excluded.

The Canonical declaration must contain `source.commit` equal to the inspected exact revision. A declaration cannot label bytes from one revision as another revision.

## 3. Candidate specification

Schema identifier:

```text
modulecatalog.repository-asset-candidate-spec.v1
```

Example:

```json
{
  "schema_version": "modulecatalog.repository-asset-candidate-spec.v1",
  "declaration": {
    "schemaVersion": 1,
    "id": "example-module",
    "name": "Example Module",
    "version": "1.0.0",
    "summary": "Explicit summary from the project authority.",
    "purpose": "Explicit purpose from the project authority.",
    "responsibility": "Explicit responsibility from the project authority.",
    "layers": ["Feature"],
    "languages": ["JavaScript"],
    "runtimes": ["Node.js 22"],
    "tags": ["example"],
    "dependencies": [],
    "constraints": [],
    "source": {
      "repository": "owner/repository",
      "commit": "0123456789abcdef0123456789abcdef01234567"
    },
    "verifiedAt": "2026-10-02T00:00:00.000Z"
  },
  "files": {
    "design": "docs/design.md",
    "logic": "docs/logic.md",
    "architecture": "docs/architecture.md",
    "evidence": "verification/evidence.json",
    "source": ["src/index.js"],
    "normal_tests": ["test/normal.test.js"],
    "user_tests": ["test/user.test.js"]
  }
}
```

The declaration is explicit Canonical input. It is validated with the existing `validateMeta()` contract; the Factory does not synthesize missing `name`, `purpose`, `responsibility`, layer, language, runtime, dependency, constraint, source, or verification timestamp values.

The file map is also explicit. The Factory does not infer that a random test is a User Test or that a random Markdown file is Architecture evidence.

## 4. File mapping

All mapped paths are relative to the optional `asset_root` inside the repository.

Required roles:

- Design
- Logic
- Architecture
- Evidence
- one or more Source files
- one or more Normal Test files
- one or more User Test files

Mapped repository paths must be unique and cannot escape the selected repository root.

Materialization maps them into the existing registration layout:

```text
meta.json
 design.md
 logic.md
 architecture.md
 evidence.json
 source/<mapped source path>
 tests/normal/<mapped normal test path>
 tests/user/<mapped user test path>
```

`README.md` remains optional because the current Asset admission contract does not require it. The Reusable Exporter emits a README Knowledge Unit only when a registered Asset actually contains a non-empty README.

## 5. Missing facts

If a required mapped repository file is absent at the exact revision, assessment returns:

```text
status=INCOMPLETE
```

with `missing_requirements` containing the exact missing role and path.

The Factory does not:

- create placeholder Design/Logic/Architecture documents;
- mark an unverified Test as passed;
- fabricate Evidence;
- infer User Test status from a filename alone;
- copy current Working Tree bytes over exact-revision bytes;
- register an incomplete candidate.

## 6. Materialization and admission

Candidate output must be outside the ModuleCatalog working tree.

Before an output directory is published, the temporary candidate is passed through the existing `validateAssetDirectory()` admission validation. This enforces current required documents, Source, Normal/User Test presence, Evidence PASS records, file-size limits, secret scanning, and path/symlink safety.

On success:

```text
status=READY_FOR_ADMISSION
admission.catalog_registered=false
admission.manifest_created=false
admission.validation_complete=true
```

The existing explicit `register <candidate-directory>` command remains the only operation that creates the Catalog Asset directory, creates its Manifest, and rebuilds the Catalog index.

## 7. CLI

Assessment only:

```bash
node src/cli.js repository-candidate \
  --repo /path/to/repository \
  --revision <40-char-sha> \
  --asset-root path/to/module \
  --spec /path/to/candidate-spec.json \
  --json
```

Materialize after successful assessment:

```bash
node src/cli.js repository-candidate \
  --repo /path/to/repository \
  --revision <40-char-sha> \
  --asset-root path/to/module \
  --spec /path/to/candidate-spec.json \
  --output /outside/modulecatalog/candidate \
  --json
```

Registration is intentionally separate:

```bash
node src/cli.js register /outside/modulecatalog/candidate
```

## 8. Mutation boundary

Candidate assessment and materialization:

```text
source_repository = no mutation
ModuleCatalog canonical assets = no mutation
KB runtime = no mutation
```

Materialization writes only the explicitly selected external candidate output directory.

No Merge, Deploy, Production change, KB activation, or source-repository change is implied by this contract.
