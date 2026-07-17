# Reusable Asset Format

登録候補Directoryは次を満たす。

```text
<asset>/
├─ meta.json
├─ design.md
├─ logic.md
├─ architecture.md
├─ evidence.json
├─ code/
└─ tests/
   ├─ normal/
   └─ user/
```

登録後に`manifest.json`が追加される。

## meta.json 必須項目

- `schemaVersion`: `1`
- `id`: 小文字英数字と`-`、3〜80文字
- `name`, `version`, `summary`, `purpose`, `responsibility`
- `layers`: `Part|Feature|Component|System|Application System`
- `languages`, `runtimes`, `tags`, `dependencies`, `constraints`
- `source.repository`, `source.commit`
- `verifiedAt`: ISO 8601

## evidence.json 必須条件

- `normal.passed` と `user.passed` が共に `true`
- 各系統に実行内容と期待結果を記録する
- 実際の検証を行っていない証跡は登録しない

## 登録対象

Codeだけ、設計だけ、未検証案、Mock、Stub、仮実装は登録しない。Code、設計、Logic、Architecture、通常Test、ユーザー利用Test、検証結果、依存・制約、出所を一体登録する。
