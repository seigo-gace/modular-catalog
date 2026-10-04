# TGserver ZERO Integration — ModuleCatalog

Status: Current integration authority for development evidence and runtime-log retrieval
Generation: `TGserver ZERO`
vNext: `FALSE`

## Current TGserver authority boundary

- Existing central Reader base on `seigo-gace/TGserver` main: `9282f3540f9bf47cfad7e7814da8fd7145d44bba`.
- Current ZERO source candidate: TGserver Draft PR #19, head `50105591dc7a25d68fb2a4e9e8099ab312657b08`.
- PR #19 contains the P012 registry mapping and is OPEN / DRAFT / UNMERGED. Its source changes are not treated as Production Runtime until separately approved and deployed.
- Live Telegram provisioning is separate runtime evidence; P012 severity topics are already present in G002 from the verified 65/65 topic provision result.

## Purpose

ModuleCatalog separates development evidence from runtime evidence so CHAT can continue development without Master copying terminal output by hand.

```text
Source / Test / Verify evidence
  -> ModuleCatalog GitHub Actions Development Probe
  -> Job Log + sanitized Artifact
  -> CHAT readback

Runtime / Server log evidence
  -> ModuleCatalog P012 producer
  -> TGserver ZERO /ingest/bulk
  -> Telegram durable raw log + rebuildable search index
  -> TGserver ZERO central Reader in seigo-gace/TGserver
  -> sanitized Artifact
  -> CHAT readback
```

ModuleCatalog does not call TGserver `/search` directly and does not store Cloudflare Access or a per-producer TGserver log secret.

## Development Probe

Workflow: `.github/workflows/dev-probe.yml`

The workflow reuses the repository's existing Catalog Verify dependency-install route and canonical verification only:

```text
npm install --ignore-scripts --no-audit --no-fund --package-lock=false
npm run check
npm run verify:portable
```

The repository intentionally has no dependency lock file in this branch, so the Development Probe does not enable `setup-node` npm caching and does not use `npm ci`. `npm run check` already includes the repository's normal/user/reusable tests and `npm run verify`; the probe does not introduce another test framework.

Trigger boundaries:

- `[DEV-PROBE]` Issue opened by the repository owner;
- owner-authored same-repository Pull Request events for feature-branch source verification;
- owner-only `workflow_dispatch` for explicit manual source verification.

Issue title/body are never converted into shell commands. The commands executed by the workflow are fixed in repository source. The workflow has only `contents: read` and `issues: read` permissions and has no deploy/restart/recreate/secret/provider mutation path.

For Pull Request events, the workflow explicitly checks out `pull_request.head.sha` rather than GitHub's synthetic merge ref. The Artifact `sha` field is populated from `git rev-parse HEAD`, while `event_sha` retains the GitHub event SHA separately. This keeps Source evidence bound to the exact Project revision under test.

Artifact: `dev-probe-evidence-<run-id>`

Artifact contents are bounded to:

- `meta.json` — repository, exact checked-out Source SHA, event SHA, event, run ID;
- `check.log` — canonical `npm run check` output;
- `portable.log` — canonical portable-reuse verification output.

The evidence directory is created under `${RUNNER_TEMP}` rather than the checked-out repository, because ModuleCatalog's revision-bound export correctly refuses a dirty Working Tree. This also keeps the Artifact path non-hidden. `meta.json` is created before Node setup so an early environment/setup failure can still leave bounded diagnostic evidence for CHAT. No secret value is intentionally written to the artifact.

## P012 runtime producer

Source: `src/tgserver-zero-producer.js`, wired from `src/cli.js`.

Contract:

- fixed ZERO project identity: `P012`;
- canonical endpoint: `POST /ingest/bulk` with `logs[]`;
- severity: CLI completion=`info`, CLI failure=`error`;
- message contains only fixed event name, allowlisted command name, bounded duration, and bounded internal error code;
- arbitrary exception text, asset content, prompts, KB payload, filesystem content, credentials, and Secret values are not forwarded;
- no per-producer TGserver log secret/header is introduced;
- receipt count must match and every result must be `accepted` or `duplicate`;
- configured timeout is bounded to 10 seconds, default 1.5 seconds;
- transport/receipt failure returns fail-open status and does not change the ModuleCatalog command result.

Configuration example: `.env.tgserver-zero.example`.

```text
TGSERVER_LOG_URL=http://127.0.0.1:3000
TGSERVER_LOG_TIMEOUT_MS=1500
```

This Source contract alone does not prove the deployed server has the variables configured or that Telegram raw storage succeeded.

## TGserver ZERO runtime evidence intake

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

Direct Project-to-TGserver search adapter injection is rejected with `TGS_DIRECT_ACCESS_DISABLED`.

## Current registration / verification state

Current split state:

```text
TGZERO_PROJECT_ID=P012
TGZERO_REGISTRY_SOURCE=PASS_ON_TGSERVER_PR19_UNMERGED
TGZERO_TOPIC_PROVISIONED=PASS
TGZERO_PRODUCER_SOURCE=IMPLEMENTED_ON_PROJECT_BRANCH
TGZERO_PRODUCER_RUNTIME=NOT_VERIFIED
TGZERO_TELEGRAM_RAW=NOT_VERIFIED
TGZERO_SEARCH=NOT_EXECUTED
```

Do not promote Source registration or Topic existence into runtime producer PASS. Real producer verification requires the Project Source to reach the target runtime, an actual P012 event to be accepted, Telegram raw persistence to be evidenced, and central Reader retrieval to return the same evidence after the TGserver Reader/registry source is deployed.

## CHAT operating procedure

For Source/Test/Verify evidence:

1. use the Development Probe run for the exact ModuleCatalog revision;
2. read the GitHub Actions job result/log directly;
3. read the matching `dev-probe-evidence-<run-id>` Artifact;
4. keep Source/Test/CI status separate from Runtime status.

For Runtime/Server logs after approved Source deployment:

1. emit only through the P012 runtime producer;
2. use `seigo-gace/TGserver` central Reader for retrieval;
3. request the exact registered repository + explicit stream;
4. read `tgserver-zero-search-meta.json` first to bind repo/stream/project_id;
5. read `tgserver-zero-search-result.json` as sanitized runtime evidence;
6. never copy Cloudflare Access/TGserver secrets into ModuleCatalog.

## State boundary

```text
Source implemented != CI PASS
CI PASS != Runtime log producer verified
Topic provisioned != Telegram raw log verified
Runtime send PASS != Central Reader search PASS
Runtime search PASS != Source/Test PASS
```

Each state is promoted only from its own Evidence.
