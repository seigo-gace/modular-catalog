# Open Source Skill / Script Collector

GitHub、GitLab、npm、PyPI、crates.ioをカテゴリ・キーワード別に検索し、言語を限定せずSkill・Script・Library・CLI・Adapter候補を収集します。Sourceを安全に展開し、Architecture、Logic、Entry Point、Public Symbol、Dependency、Test、Document、License、Secret Risk、再利用可能性を抽出します。

## 実行基盤の固定条件

このModuleはServerへDeployしません。

- 常駐Process、HTTP Server、Daemon、Container Serviceを起動しません。
- Cron、Schedule、Webhookによる自律実行を行いません。
- 実行場所は、GitHub Actionsの手動`workflow_dispatch`、AI Assistantが使用する一時実行環境、またはAI Assistantが作成した限定Run RequestへのPushだけです。
- RepositoryはCode・設定・Test・実行履歴・成果物を保持する実行正本です。
- Astera内部Codeは保持・複製せず、判断材料生成と判定はAstera APIだけを呼び出します。
- API Key、Token、Notion CredentialをRepositoryへ保存しません。

詳細な境界は[`EXECUTION_POLICY.md`](EXECUTION_POLICY.md)を参照してください。

## 固定フロー

```text
Category Plan / Quota
  -> Provider Adapters
  -> Global Deduplication
  -> Safe Source Acquisition
  -> Multi-language Static Analysis
  -> Modular Decomposition or Logic Build
  -> Part -> Feature -> Component -> System -> Application System Reconstruction
  -> New skill.md / Contract / Design / Logic / Architecture
  -> Astera /v1/skill/process
  -> Astera /v1/skill/evaluate
  -> below 95 or blocking: Astera Debug -> Rebuild -> Re-evaluate
  -> Fail-closed Admission
  -> Specified Notion data-source upsert
  -> Optional modular-catalog register
```

## Astera反復判定

- Quality 95以上。
- Completion 95以上。
- Blocking 0。
- `KB_ELIGIBLE`かつ`evaluation_complete=true`。
- 条件未達時は前回評価をAsteraへ戻し、Skill・Design・Logic・Architectureを補正して再判定します。
- 既定最大3 Debug Roundです。
- 上限到達後も未達の場合は未完成として終了し、Notion完成台帳とCatalogへ登録しません。

## Modular Architecture

各候補は推奨Layerを付けるだけではなく、次の全階層へ再構築します。

```text
Application System
  -> System
    -> Component
      -> Feature
        -> Part
```

結果は`source/reconstruction.json`と`source/module-contract.json`へ保存し、新規再構築Skillを`skill.md`へ生成します。Upstream Codeそのものを完成Skillとは扱いません。

## 250件Collection Plan

`skill-collection-250.json`は次を対象とします。

- Token圧縮 20
- 言語関連 20
- 日本語特化 20
- 文書生成 20
- Context関連 20
- Prompt圧縮 20
- 長時間対応 20
- Orchestration 20
- Code生成 20
- 検索関連 20
- Claude Code／Claude各Model関連 50

合計250件です。同一Sourceを別カテゴリの件数として重複計上しません。カテゴリごとのTarget、発見数、選択数、不足数を`discovery/quota-summary.json`へ保存します。

## 安全方針

- 外部Sourceは既定で実行しません。
- Path Traversal、Symlink、Archive容量、File数、Secret Patternを検査します。
- License不明または許可外は完成登録しません。
- Astera API未設定・失敗・95/95未満・BlockingありはFail Closedです。
- Source URL、Version/Ref、実Byte Content Hash、License、判定履歴を保持します。
- 元Codeを無条件にコピーせず、Architecture・Logic・Capabilityを責務境界へ再構成します。
- NotionへはAstera完成判定済みRecordだけをUpsertします。

## Test

```bash
cd collector
python -m unittest discover -s tests -p 'test_*.py' -v
```

## 250件Run

```bash
cd collector
export ASTERA_PROCESS_BASE_URL='...'
export ASTERA_EVALUATOR_BASE_URL='...'
export ASTERA_SKILL_API_KEY='...'
export NOTION_TOKEN='...'
export NOTION_DATA_SOURCE_ID='10d3c0ac-5b2b-4f3b-8a22-a2b7685003bb'

python -m modular_collector run \
  --config skill-collection-250.json \
  --workspace ../collector-output \
  --process-limit 250 \
  --max-debug-rounds 3 \
  --catalog-root .. \
  --register \
  --sync-notion \
  --json
```

GitHub Actionsでは手動Dispatch、またはAI Assistantが作成する`collector/run-requests/*.request.json`への限定Pushで実行します。Schedule、Cron、Webhook、Server常駐はありません。

## 出力

- `discovery/candidates.json`: 全選択候補
- `discovery/categories/<category>.json`: カテゴリ別候補
- `discovery/quota-summary.json`: Target・選択・不足
- `discovery/failures.json`: Provider単位の失敗
- `sources/`: 取得Source
- `candidates/<asset-id>/`: 再構築Skill
- `results/checkpoint.jsonl`: Candidate単位の逐次Checkpoint
- `results/admissions.json`: Local／Astera／Catalog判定
- `results/notion-export.json`: 指定Notion台帳同期Record
- `results/notion-sync-results.json`: Notion作成・更新・Skip・失敗
- `collector/run-results/<run-id>.result.json`: GitHub Runの最終結果

## Module一覧

詳細は[`MODULES.md`](MODULES.md)を参照してください。
