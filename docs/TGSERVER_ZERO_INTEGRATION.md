# TGserver ZERO Integration — ModuleCatalog

Status: Current integration authority for development evidence and runtime-log retrieval
TGserver ZERO authority: `seigo-gace/TGserver@9282f3540f9bf47cfad7e7814da8fd7145d44bba`
Generation: `TGserver ZERO`
vNext: `FALSE`

## Purpose

ModuleCatalog separates development evidence from runtime evidence so CHAT can continue development without Master copying terminal output by hand.

```text
Source / Test / Verify evidence
  -> ModuleCatalog GitHub Actions Development Probe
  -> Job Log + sanitized Artifact
  -> CHAT readback

Runtime / Server log evidence
  -> TGserver ZERO central Reader in seigo-gace/TGserver
  -> legacy /search behind Cloudflare Access
  -> sanitized Artifact
  -> CHAT readback
```

ModuleCatalog does not call TGserver `/search` directly and does not store Cloudflare Access or TGserver credentials.

## Development Probe

Workflow: `.github/workflows/dev-probe.yml`

The workflow reuses the repository's existing canonical verification only:

```text
npm ci
npm run check
npm run verify:portable
```

`npm run check` already includes the repository's normal/user/reusable tests and `npm run verify`; the probe does not introduce another test framework.

Trigger boundaries:

- `[DEV-PROBE]` Issue opened by the repository owner;
- owner-authored same-repository Pull Request events for feature-branch source verification;
- owner-only `workflow_dispatch` for explicit manual source verification.

Issue title/body are never converted into shell commands. The commands executed by the workflow are fixed in repository source. The workflow has only `contents: read` and `issues: read` permissions and has no deploy/restart/recreate/secret/provider mutation path.

Artifact: `dev-probe-evidence-<run-id>`

Artifact contents are bounded to:

- `meta.json` — repository, exact GitHub SHA, event, run ID;
- `check.log` — canonical `npm run check` output;
- `portable.log` — canonical portable-reuse verification output.

No secret value is intentionally written to the artifact.

## TGserver ZERO runtime evidence

TGserver ZERO central Reader remains owned by `seigo-gace/TGserver`.

ModuleCatalog only consumes the sanitized pair produced by that Reader:

```text
tgserver-zero-search-meta.json
tgserver-zero-search-result.json
```

The local Factory helper validates:

- `generation = TGserver ZERO`;
- exact expected repository;
- explicit expected stream;
- registered `P<number>` project ID supplied by the central Reader metadata;
- observed hit project IDs match that metadata.

The Project ID is never inferred or hard-coded by ModuleCatalog.

Direct Project-to-TGserver adapter injection is rejected with `TGS_DIRECT_ACCESS_DISABLED`.

## Current registration state

At the TGserver ZERO authority revision listed above, ModuleCatalog is not present in the ZERO project registry.

```text
TGZERO_PROJECT_REGISTERED=UNREGISTERED
TGZERO_PRODUCER=NOT_VERIFIED
TGZERO_SEARCH=NOT_EXECUTED
```

No existing P-number is reused. Formal registry/producer onboarding belongs to a separate TGserver-owned change. Until that is completed, ModuleCatalog runtime-log evidence must remain unavailable rather than guessed.

## CHAT operating procedure

For Source/Test/Verify evidence:

1. use the Development Probe run for the exact ModuleCatalog revision;
2. read the GitHub Actions job result/log directly;
3. read the matching `dev-probe-evidence-<run-id>` Artifact;
4. keep Source/Test/CI status separate from Runtime status.

For Runtime/Server logs after formal TGserver ZERO registration:

1. use `seigo-gace/TGserver` central Reader only;
2. request the exact registered repository + explicit stream;
3. read `tgserver-zero-search-meta.json` first to bind repo/stream/project_id;
4. read `tgserver-zero-search-result.json` as sanitized runtime evidence;
5. never copy Cloudflare Access/TGserver secrets into ModuleCatalog.

## State boundary

```text
Source implemented != CI PASS
CI PASS != Runtime log producer verified
Runtime search PASS != Source/Test PASS
```

Each state is promoted only from its own Evidence.
