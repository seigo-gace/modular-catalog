# Modular Catalog

完成・検証済みの再利用資産を、**必要なときに必要な情報だけ読む**ためのPrivate Repositoryです。

資産はCode単体ではなく、設計・Logic・Architecture・通常Test・ユーザー利用Test・検証結果・依存・制約・出所を一体で保存します。Catalogへの実行時依存は作らず、再利用時は対象Projectへ取り込んで再検証します。

## ChatGPT運用

パーソナルのカスタムプロンプトには [`prompts/PERSONAL_CUSTOM_PROMPT.md`](prompts/PERSONAL_CUSTOM_PROMPT.md) を使用します。

ChatGPTは開発作業時に次の順序だけで読みます。

1. [`CHATGPT_WORK_CONTROL.md`](CHATGPT_WORK_CONTROL.md)
2. 対象Projectの現物
3. [`catalog/index.json`](catalog/index.json)
4. 上位候補の `assets/<id>/meta.json`
5. 採用候補の必要Sectionだけ

全Assetの一括読込は禁止です。

## 多段検索

- **Index**: ID、Hash、目的、責務、5段位置、言語、Runtime、Tag、依存、制約から候補を圧縮検索
- **Metadata**: 上位候補だけを再評価
- **Selective Read**: 設計、Logic、Architecture、Code、Test、Evidenceの必要Sectionだけを取得
- **Hash**: `manifest.json`のSHA-256で欠落・改変を検出

```bash
node src/cli.js search --query "webhook retry" --language JavaScript --layer Feature
node src/cli.js show verified-http-retry --section architecture
node src/cli.js show verified-http-retry --section code
```

## 資産登録

候補Directoryは [`docs/ASSET_FORMAT.md`](docs/ASSET_FORMAT.md) に従います。

```bash
node src/cli.js register /path/to/completed-asset
```

登録時に次を必須確認します。

- Code、設計、Logic、Architectureが揃っている
- 通常Testとユーザー利用Testの両方が合格している
- Test内容と期待結果がEvidenceへ記録されている
- Secret、Symbolic Link、Path逸脱がない
- Manifest Hashが生成される
- 圧縮Indexが更新される

## 検証

```bash
npm run check
```

実行内容:

- Node構文検査
- 通常Test
- 実際のCLI操作によるユーザー利用Test
- Index整合性検証

## 構成

```text
CHATGPT_WORK_CONTROL.md       ChatGPT専用の短い補正ルール
prompts/PERSONAL_CUSTOM_PROMPT.md
catalog/index.json            常時読む圧縮Index
src/catalog.js                検証・Hash・登録・多段検索・選択読込
src/cli.js                    CLI入口
docs/ARCHITECTURE.md          設計・Logic・Architecture
docs/ASSET_FORMAT.md          再利用資産の登録仕様
test/                         通常Test・ユーザー利用Test・Fixture
assets/<id>/                  登録時に作成される検証済み資産
```

`assets/`は最初の実資産登録時に作成します。空Directoryや未完成資産は置きません。
