# HF Four External Capability Modules

AMATERAS本体とは別の外部能力Module群。AI人格や主役AIとして扱わず、すべて入出力Contractを持つModuleとして実装する。

## Modules

1. `task-aggregate` — Task分解と構造統合。最終判断は禁止。
2. `research-evidence` — 検索・Source評価・Claim/Evidence。
3. `architecture-code` — Logic抽出・Modular再構築・Code/Test/Debug。
4. `language-review` — 日本語・文書・圧縮・独立Review。

## HF resources per module

- 1 Docker Space: API runtime
- 1 Dataset repository: versioned contracts and admitted Skill artifacts
- 1 Bucket: checkpoints, candidates, evidence, logs and intermediate artifacts

## Gemini free-tier control

Each module receives a fixed share of the Google AI project quota. Limits are configured with `GEMINI_MODULE_RPM`, `GEMINI_MODULE_TPM`, and `GEMINI_MODULE_RPD`; a safety margin is applied before requests. Provider 429 responses block further calls and return a checkpointed partial result. No paid-tier fallback is enabled.

## Provision

```bash
export HF_TOKEN=...
export GEMINI_API_KEY=...
python hf-modules/provision.py --namespace G-ACE
```

`--dry-run` prints the planned 4 Space / 4 Repository / 4 Bucket IDs without creating them.

## Completion boundary

Module output is always `complete=false` until the external Astera quality/completion evaluator has confirmed Quality >=95, Completion >=95 and Blocking=0. AMATERAS performs selection, routing, comparison and finalization outside these modules.
