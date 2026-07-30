# Open Source Skill / Script Collector

GitHub、GitLab、npm、PyPI、crates.ioをカテゴリ・キーワード別に検索し、言語を限定せずSkill・Script・Library・CLI・Adapter候補を収集します。Sourceを安全に展開し、Architecture、Logic、Entry Point、Public Symbol、Dependency、Test、Document、License、Secret Risk、再利用可能性を抽出します。

## 実行基盤の固定条件

このModuleはServerへDeployしません。

- 常駐Process、HTTP Server、Daemon、Container Serviceを起動しません。
- Cron、Schedule、Webhookによる自律実行を行いません。
- 実行場所は、GitHub Actionsの手動`workflow_dispatch`またはAI Assistantが使用する一時実行環境だけです。
- RepositoryはCode・設定・Test・実行履歴・成果物を保持する実行正本です。
- Astera内部Codeは保持・複製せず、判断材料生成と判定はAstera APIだけを呼び出します。
- API Key、Token、Notion CredentialをRepositoryへ保存しません。
- Collection Configが正式に選択される前に、件数を推測して収集Runを開始しません。

詳細な境界は[`EXECUTION_POLICY.md`](EXECUTION_POLICY.md)を参照してください。

## 固定フロー

```text
Collection Config
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
  -> Selection Profile / Compatibility Index
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

## Skill Poolと選択原則

Skill収集の目的は、項目を狭く整理して候補を減らすことではありません。開発時に利用できる能力の分母を増やし、同じ目的に対して異なる精度、速度、Cost、Runtime、得意条件を持つ複数候補から選べる状態を作ることです。

```text
Taskを分解
  -> 必要能力を特定
  -> 既存Skillを検索
  -> Capability / Input / Output / 制約 / 品質 / 速度 / Costを比較
  -> 最適Skillを選択
  -> 補完関係にあるSkillを編成
  -> 不足部分だけ新規開発
```

商用利用、改変、再配布等は収集後に保持する管理情報と実利用時のGateです。探索対象を商用利用可能なものだけへ限定する条件ではありません。

## Collection Config

カテゴリ名、検索Query、Provider、対象言語、カテゴリ別件数はJSON Configから読み込みます。Skill選択層はカテゴリ数・総件数を固定せず、選択されたConfigの結果をそのまま索引化します。

```json
{
  "categories": [
    {
      "id": "category-id",
      "target_count": 10,
      "queries": ["search terms"]
    }
  ]
}
```

既存の収集Configは削除せず履歴として保持しますが、正式な対象項目と件数が確定するまでは新しい収集Runの根拠として使用しません。

## 横断能力索引

`skill-taxonomy.json`は、収集カテゴリを置き換えるものではなく、取得後のSkillを次の18能力領域で横断検索するための索引です。

- 理解・解析
- 検索・根拠収集
- 圧縮・Context管理
- 推論・判断・計画
- 言語・日本語処理
- 文書・Content生成
- Code・Software Engineering
- Test・Debug・品質
- Data処理・分析
- Memory・KB・RAG
- Agent・Orchestration
- API・Tool・外部連携
- 自動化・長時間実行
- Infrastructure・運用
- Security・Risk
- 各AI・各Model固有能力
- UI・UX・Design
- 業務・専門分野

未登録のカテゴリIDも処理可能で、上位索引が未定の場合は解析結果・Capability・Keywordを使って検索します。

## Selection Profile

Astera Admission後、各Skillに次を生成します。

- 能力領域
- 解決する課題
- Input Contract
- Output Contract
- 得意条件
- 制約・避ける条件
- 実行方式
- 依存関係
- 推定Speed / Cost
- 組合せ可能な能力領域とSkill
- 検索Keyword
- Base Fitness Score
- Selectable / Selection Readiness

保存先は次です。

- `candidates/<asset-id>/selection-profile.json`
- `results/selection-index.json`

## Skill選択CLI

`selection-request.example.json`をコピーして、Taskと必要能力を指定します。

```bash
cd collector
python -m modular_collector select \
  --index ../collector-output/results/selection-index.json \
  --request selection-request.example.json \
  --output ../collector-output/results/selection-result.json \
  --json
```

選択結果は、候補の順位、選択理由、Profile、Primary / Support / Alternativeの編成案を返します。適合する既存Skillがない場合は`new-skill-or-no-existing-skill`を返し、不適切なSkillを無理に選びません。

## 安全方針

- 外部Sourceは既定で実行しません。
- Path Traversal、Symlink、Archive容量、File数、Secret Patternを検査します。
- License不明または許可外は完成登録しません。
- Astera API未設定・失敗・95/95未満・BlockingありはFail Closedです。
- Source URL、Version/Ref、実Byte Content Hash、License、判定履歴を保持します。
- 元Codeを無条件にコピーせず、Architecture・Logic・Capabilityを責務境界へ再構成します。
- NotionへはAstera完成判定かつSelection ReadyのRecordだけをUpsertします。

## Test

```bash
cd collector
python -m unittest discover -s tests -p 'test_*.py' -v
```

## 実行

正式に選択されたConfigを明示して手動実行します。

```bash
cd collector
python -m modular_collector run \
  --config <approved-collection-config.json> \
  --workspace ../collector-output \
  --max-debug-rounds 3 \
  --sync-notion \
  --json
```

GitHub Actionsは手動Dispatchのみです。Schedule、Cron、Webhook、Server常駐はありません。

## 出力

- `discovery/candidates.json`: 全選択候補
- `discovery/categories/<category>.json`: カテゴリ別候補
- `discovery/quota-summary.json`: Target・選択・不足
- `discovery/failures.json`: Provider単位の失敗
- `sources/`: 取得Source
- `candidates/<asset-id>/`: 再構築Skill
- `candidates/<asset-id>/selection-profile.json`: Skill単体の選択用契約
- `results/checkpoint.jsonl`: Candidate単位の逐次Checkpoint
- `results/admissions.json`: Local／Astera／Catalog判定
- `results/selection-index.json`: 横断検索・比較・編成用Index
- `results/selection-result.json`: Task要求に対する選択・編成結果
- `results/notion-export.json`: 指定Notion台帳同期Record
- `results/notion-sync-results.json`: Notion作成・更新・Skip・失敗

## Module一覧

詳細は[`MODULES.md`](MODULES.md)を参照してください。
