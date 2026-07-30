# Modular Catalog

完成・検証済みの再利用資産を、必要なときに必要な情報だけ読むPrivate Repositoryです。

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

## Open Source Skill / Script Collector

`collector/`は、GitHub・GitLab・npm・PyPI・crates.ioをキーワード別に検索し、言語を問わずSkill、Script、Library、CLI、Adapter候補を収集するPython基盤です。

```text
Keyword Search
  -> Provider Adapter
  -> Safe Source Acquisition
  -> Multi-language Static Analysis
  -> Modular Architecture Reconstruction
  -> Astera /v1/skill/process
  -> Astera /v1/skill/evaluate
  -> 95/95 + Blocking 0 Admission
  -> Catalog Register
  -> Notion Export
```

外部Sourceは既定で実行しません。License不明、Secret検出、Hash不一致、Astera API失敗、品質・完成度95未満、BlockingありはFail Closedで未登録にします。

```bash
python -m unittest discover -s collector/tests -p 'test_*.py'
python collector/collector.py search --config collector/keywords.example.json --workspace collector-output --json
```

詳細は[`collector/README.md`](collector/README.md)を参照してください。
