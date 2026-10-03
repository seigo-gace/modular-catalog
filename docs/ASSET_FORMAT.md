# Reusable Asset Format

ModuleCatalogはCode専用Storeではなく、Code / Skill / Tool / Logic / Architecture / Designなど、再利用可能な資産を同じCatalogで扱う。

既存v1 Assetは従来契約をそのまま維持する。`reusableAssetTypes`を明示する新しいUniversal Assetだけ、資産種別に必要な内容を記録し、無関係なDocumentやCodeを水増ししない。

## 共通の最小構成

```text
<asset>/
├─ meta.json
├─ evidence.json
└─ tests/
   ├─ normal/
   └─ user/
```

登録後に`manifest.json`が追加される。

`tests/normal` / `tests/user`は実行Codeだけを意味しない。Design review、Architecture review、Logic verificationなど、その資産種別に対する実際の検証Evidenceを置ける。ただし`evidence.json`には実行内容と期待結果が必要で、未実施をPASSにしてはならない。

## 資産種別ごとの追加内容

`meta.reusableAssetTypes`を明示した場合、種類に応じて次だけを要求する。

- `design` → `design.md`
- `logic` → `logic.md`
- `architecture` → `architecture.md`
- `code`を含む → `source/`または`code/`
- `skill` / `tool` / その他の明示Type → 上記に該当する実内容がある場合だけ対応Typeも併記する。無関係なDesign/Logic/Architecture/Codeを捏造しない。

複合Assetは複数Typeを明示できる。例：`["tool", "code", "design"]`ならCodeとDesignの実内容を持つ。

## 既存v1 Asset互換

`reusableAssetTypes`が未記録の既存Assetは、従来どおり次を必須とする。

```text
<asset>/
├─ meta.json
├─ design.md
├─ logic.md
├─ architecture.md
├─ evidence.json
├─ source/ または code/
└─ tests/
   ├─ normal/
   └─ user/
```

この既存契約を満たしたAssetは、その実在内容から`code / design / logic / architecture / test`をDeterministic Derivedの再利用TypeとしてExport/Searchできる。`tags`に`skill`が明示されている既存Assetは`skill / capability`も追加する。これはCanonical Metadataへの書換えではなく、検証済みDirectory構造からのDerived情報である。

## meta.json 基本項目

- `schemaVersion`: `1`
- `id`: 小文字英数字と`-`、3〜80文字
- `name`, `version`, `summary`, `purpose`, `responsibility`
- `layers`, `languages`, `runtimes`, `tags`, `dependencies`, `constraints`
- `source.repository`, `source.commit`
- `verifiedAt`: ISO 8601
- `reusableAssetTypes`: Universal Assetで明示する再利用種別。複数可。
- `assetKind`: 主種別をCanonicalに記録できる場合のみ明示する。
- `fiveV`: Code Assetの5VをEvidence付きで明示できる場合のみ記録する。

明示Non-Code Assetでは`layers / languages / runtimes`を空配列にできる。Code向け値を捏造して埋めない。

## 5V境界

5VはCodeの構成階層だけに使用する。

`Part -> Feature -> Component -> System -> Application System`

- 旧`meta.layers`から`fiveV`へ自動昇格しない。
- `fiveV.applicable=true`は`reusableAssetTypes`に`code`を含むAssetだけ許可する。
- LevelとCompositionは明示Evidenceがある場合だけ記録する。
- 未確認は`NOT_RECORDED`のまま保持する。
- 使用していない上位Levelを帳尻合わせで作らない。

## evidence.json 必須条件

- `normal.passed` と `user.passed` が共に `true`
- 各系統に実行内容と期待結果を記録する
- 実際の検証を行っていない証跡は登録しない

## 禁止

- Asset Typeを名前だけから推測してCanonical化しない。
- Pure Designへ空のLogic/Architecture/Codeを追加しない。
- Pure LogicへDesign/Architecture/Codeを追加しない。
- Pure ArchitectureへDesign/Logic/Codeを追加しない。
- Legacy `layers`を5VのEvidenceとして流用しない。
- 未検証案、Mock、Stub、仮実装をVerified Assetとして登録しない。
