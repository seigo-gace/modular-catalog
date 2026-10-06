# Reusable Asset Format

ModuleCatalogは既存の登録済みAsset Contractを維持しながら、Codeだけでなく再利用可能な開発成果物全体を扱う。

## 既存Asset（互換Contract）

`reusableAssetTypes`を持たない既存Assetは従来どおり、次を一体として保持する。

```text
<asset>/
├─ meta.json
├─ design.md
├─ logic.md
├─ architecture.md
├─ evidence.json
├─ source/ または code/
├─ tests/
│  ├─ normal/
│  └─ user/
└─ manifest.json
```

既存80 AssetのID、File、Manifest、Asset Hash、Test ContractはUniversal Asset対応を理由に書き換えない。

## Universal Reusable Asset（追加Contract）

新規Assetは`meta.reusableAssetTypes`で、実際に再利用する成果物種別を明示できる。

主な種別例:
- `code`
- `skill`
- `capability`
- `tool`
- `logic`
- `architecture`
- `design`
- `contract`
- `test`
- `evidence`
- `workflow`
- `configuration`
- `integration`

明示した種別に存在しない成果物を水増ししてはならない。

- `design`を含む場合だけ`design.md`を要求する。
- `logic`を含む場合だけ`logic.md`を要求する。
- `architecture`を含む場合だけ`architecture.md`を要求する。
- `code`を含む場合は`source/`または`code/`と、Code向け`layers` / `languages` / `runtimes`を要求する。
- 非Code Assetは無関係なSource、Language、Runtime、5V levelを捏造しない。
- `evidence.json`、`tests/normal/`、`tests/user/`はVerified Reusable Assetの検証境界として維持する。
- 登録後は`manifest.json`でFile integrityを固定する。

## meta.json 共通項目

- `schemaVersion`: `1`
- `id`: 小文字英数字と`-`、3〜80文字
- `name`, `version`, `summary`, `purpose`, `responsibility`
- `tags`, `dependencies`, `constraints`
- `source.repository`, `source.commit`
- `verifiedAt`: ISO 8601
- Universal Assetでは`reusableAssetTypes`を明示できる。

`layers`の語彙は互換性のため既存の`Part|Feature|Component|System|Application System`を維持するが、**legacy `layers`を5V-RCCAへ自動昇格させない**。

## 5V-RCCA境界

5VはVerified Code Assetにだけ明示適用する。

- `meta.fiveV`が明示されていない既存Assetは`not_recorded`のまま扱う。
- 非Code Assetへ5V levelを付与しない。
- 5V level、`composedFrom`、verification basisは明示Evidenceがある場合だけCanonicalとして記録する。
- Dependencyと5V Compositionを混同しない。

## evidence.json 必須条件

- `normal.passed` と `user.passed` が共に `true`
- 各系統に実行内容と期待結果を記録する
- 実際の検証を行っていない証跡は登録しない

## 原則

既存Assetを壊して新形式へ置換しない。Universal Asset情報は追加層として扱う。Canonical factとDeterministic Derivedを分離し、Source / Design / Logic / Architecture / Test / Evidenceに存在しない内容を補完しない。
