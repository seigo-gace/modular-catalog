# Modular Catalog

完成・検証済みの個別Skill Assetを、必要なときに必要な情報だけ読むためのCatalogです。現行Catalogは80 Assetを対象とし、未検証・撤回済みAssetは掲載しません。

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

現行Catalogの80 Assetは、Git履歴とNotionで確定した個別Skill集合を現行Catalog契約へ正規化したものです。各Assetは`source/`、通常Test、ユーザー利用Test、検証結果、設計、Logic、Architecture、出所、Manifestを一体で保持します。撤回済みの旧27 Assetは現行Catalogから除外し、Git履歴だけに保持します。

`assets/`には完成・検証・Astera判定済みの実資産だけを置きます。空Directoryや未完成資産は置きません。

## Reusable Asset Schema v1 / Export

ModuleCatalog is the canonical repository for reusable development assets. The KB is a derived runtime representation and must be reproducible from the catalog.

The current export contract is defined by `schemas/reusable-asset-v1.schema.json`. It keeps Canonical data separate from deterministic Derived data and does not fabricate missing applicability or contract fields; unavailable information remains `unknown` / `not_recorded`.

Export a complete catalog bundle:

```bash
node src/cli.js export-reusable-assets --output <directory>
```

Export one asset only:

```bash
node src/cli.js export-reusable-assets approval-route-resolver --output <directory>
```

Each exported asset contains:

- `asset.json`: Reusable Asset Schema v1 projection
- `knowledge-units.jsonl`: searchable Knowledge Units with `parent_asset_id`
- `relationships.jsonl`: asset-to-unit containment and only explicitly resolvable dependency relations
- `cases.jsonl`: Normal/User test cases with PASS evidence; unextractable scenario/input/actual fields remain null
- `manifest.json`: SHA-256 bundle integrity and exact catalog provenance

The export is deliberately kept outside the catalog working tree so generated KB data cannot be accidentally committed as canonical source.
