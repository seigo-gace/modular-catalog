# 6. 再利用資産

完成・検証済みの成果から、次回開発で独立して再利用できる責務だけを抽出し、`modular-catalog/assets/`へ保存する。

再利用資産には最低限、次を含める。

```text
assets/<asset-name>/
├─ README.md
├─ source/
└─ tests/
```

不要なフォルダは作らない。

`README.md`には次だけを書く。

- 目的
- 対象責務
- 入力・出力
- 依存関係
- 使用方法
- 使用条件・制約
- 検証内容
- 元Repository・Commit
- Version

登録できるのは次を満たす資産だけとする。

- 実際の開発で使用済み
- 通常テストとユーザー利用テストで検証済み
- 未完成、Mock、Stub、仮実装を含まない
- Project固有情報とSecretを除去済み
- 単独の責務として再利用可能
- 使用条件と制約が明確

再利用時は対象Projectへ取り込み、そのProject内で再検証する。

`modular-catalog`への実行時接続や、共通Coreへの常時依存は作らない。
