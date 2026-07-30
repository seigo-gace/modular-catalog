# Collector Execution Policy

## 1. Purpose

`collector/` is a repository-hosted execution module used by an AI assistant and manually dispatched GitHub Actions. It discovers, analyzes, reconstructs, and evaluates open-source Skill and Script candidates.

It is not a hosted product, API server, daemon, or continuously running service.

## 2. Allowed execution environments

Only the following execution environments are allowed:

1. GitHub Actions started by `workflow_dispatch`.
2. An ephemeral local or sandbox runtime directly controlled by the AI assistant.

The Repository is the source of truth for Code, configuration, tests, run evidence, and admitted outputs.

## 3. Prohibited deployment modes

The Collector must not add or require:

- VPS or dedicated Server deployment.
- Long-running HTTP listeners.
- Daemons, systemd units, supervisors, or background workers.
- Docker Compose or Kubernetes services for continuous operation.
- Public Ports, Ingress, Tunnel, or Health Check endpoints.
- Cron or GitHub Actions `schedule` execution.
- Webhook-triggered autonomous collection.
- A persistent database required to keep the Collector alive.

## 4. Astera boundary

Astera is used only through its API contracts:

- `POST /v1/skill/process`
- `POST /v1/skill/evaluate`

The Collector must not copy, vendor, import, or reimplement Astera Runtime internals.

Required credentials are supplied only at execution time:

- `ASTERA_PROCESS_BASE_URL`
- `ASTERA_EVALUATOR_BASE_URL`
- `ASTERA_SKILL_API_KEY`

Missing configuration, API failure, invalid response, Quality below 95, Completion below 95, or any Blocking result must fail closed.

## 5. GitHub boundary

GitHub is used for:

- Source Code and configuration storage.
- Manual execution through GitHub Actions.
- CI validation.
- Run artifacts.
- Draft Pull Requests containing admitted catalog assets.

GitHub Actions must not deploy the Collector to any Server.

## 6. modular-catalog boundary

The Collector is an independent Module in the same Repository.

`modular-catalog` stores completed development assets decomposed as:

```text
Application System
→ System
→ Component
→ Feature
→ Part
```

The Collector may pass an asset to the Catalog only after local safety checks and Astera API admission succeed. Collection candidates, temporary Source, processing state, and Collector Runtime Code must not be mixed into `assets/`.

## 7. Notion boundary

Notion is a searchable ledger, not an execution dependency or hosting environment.

Only completed, Astera-admitted, and successfully registered records may be marked as reusable. Credentials must be supplied at execution time and never committed.

## 8. Change gate

Any future change that introduces autonomous scheduling, Server deployment, a listening Port, a long-running Process, or Astera internal Code is a boundary violation and must be rejected.
