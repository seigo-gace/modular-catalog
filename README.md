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

`assets/`は最初の実資産登録時に作成します。空Directoryや未完成資産は置きません。
