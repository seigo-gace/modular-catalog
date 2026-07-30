# Modular Catalog

完成・検証済みの再利用資産を、必要なときに必要な情報だけ読むPrivate Repositoryです。

## Repository内の独立Module

このRepositoryには、責務を混ぜない独立Moduleを置きます。

```text
modular-catalog/
├── src/                 # 完成済み開発物を検索・検証・登録するCatalog本体
├── assets/              # Application System → System → Component → Feature → Partへ分解済みの完成資産
├── catalog/             # Catalog Index
├── control/             # Work Control
├── test/                # Catalog本体のTest
└── collector/           # Open Source Skill／Script探索・解析用の独立Python Module
```

### Catalog本体

Catalog本体は、別工程で完成・検証された開発物をModular Architectureに従って分解し、再利用可能な成果物として登録・検索します。

- Application System
- System
- Component
- Feature
- Part

Catalog本体はOpen Source探索、AI能力補強、Task分解、WORK AI実行を担当しません。

### Collector Module

`collector/`は、GitHub・GitLab・npm・PyPI・crates.ioをキーワード別に探索し、言語を問わずSkill、Script、Library、CLI、Adapter候補を解析する独立Python Moduleです。

Collectorは独自の`pyproject.toml`、CLI、Test、Workflowを持ち、rootの`package.json`やCatalog本体のTestへ依存しません。

CollectorからCatalogへの接続は、完成・検証・Astera判定済み成果物を渡す任意のRegistration Adapterだけに限定します。Collector内部Code、未完成候補、収集中Dataを`assets/`へ直接混在させません。

CollectorはServerへDeployしません。常駐Process、HTTP Server、Daemon、Cron、Webhook、GitHub Actions Scheduleを持たず、AI Assistantが使う一時実行環境または手動`workflow_dispatch`だけで実行します。Asteraは`/v1/skill/process`と`/v1/skill/evaluate`をAPI経由で呼び出し、Astera内部Codeを保持しません。

## ChatGPTアプリ

パーソナルのカスタムプロンプトには `prompts/PERSONAL_CUSTOM_PROMPT.md` を使用します。

開発時は次の順序で読みます。

1. `CHATGPT_WORK_CONTROL.md`
2. `control/index.json`
3. 作業に必要な `control/sections/` だけ
4. `catalog/index.json`
5. 候補Assetの `meta.json`
6. 採用候補の必要Sectionだけ

Work ControlとAssetの全ファイル一括読込は通常行いません。

## Work Control

- `CHATGPT_WORK_CONTROL.md`: 短い入口
- `control/index.json`: 作業種別から必要Sectionを選ぶIndex
- `control/sections/`: 大元の7責務を分解した正本
- `control/manifest.json`: SHA-256整合性情報
- `src/control.js`: 選択とHash検証
- `test/control.test.js`: 選択・改変検知Test

## 再利用Asset

AssetはCode単体ではなく、設計・Logic・Architecture・通常Test・ユーザー利用Test・検証結果・依存・制約・出所を一体で保存します。

```bash
node src/cli.js search --query "http retry" --language JavaScript --layer Feature
node src/cli.js show verified-http-retry --section architecture
node src/cli.js register /path/to/completed-asset
npm run check
```

検索対象はMeta情報だけではなく、各Assetの`design.md`、`logic.md`、`architecture.md`本文を含みます。検索結果の`matchedSections`で一致した文書種別を確認し、`show <asset-id> --section all`でSourceと3文書を一括取得できます。

Astera v8は、検証済みSourceを`Part → Feature → Component → System → Application System`の責務境界へ分解した27 Assetとして登録しています。各Assetは`source/`、通常Test、ユーザー利用Test、Astera判定結果、設計、Logic、Architectureを一体で保持します。

`assets/`には完成・検証・Astera判定済みの実資産だけを置きます。空Directoryや未完成資産は置きません。

## Collectorの実行

```text
Manual GitHub Dispatch / AI Assistant Execution
  -> Keyword Search
  -> Provider Adapter
  -> Safe Source Acquisition
  -> Multi-language Static Analysis
  -> Capability / Architecture / Logic Extraction
  -> Astera API /v1/skill/process
  -> Astera API /v1/skill/evaluate
  -> Admission Decision
  -> Notion Search Ledger
  -> Optional Catalog Registration Adapter
```

外部Sourceは既定で実行しません。License不明、Secret検出、Hash不一致、Astera API失敗、品質・完成度95未満、BlockingありはFail Closedで未登録にします。

```bash
python -m unittest discover -s collector/tests -p 'test_*.py'
python collector/collector.py search --config collector/keywords.example.json --workspace collector-output --json
```

詳細は[`collector/README.md`](collector/README.md)と[`collector/EXECUTION_POLICY.md`](collector/EXECUTION_POLICY.md)を参照してください。
