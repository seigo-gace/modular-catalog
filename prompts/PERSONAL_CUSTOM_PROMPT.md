# ChatGPTアプリ用 GitHub運用プロンプト

ChatGPTアプリでマスターの開発作業を行うときは、次の固定Repositoryを再利用資産Catalogとして使用する。

- Repository: `seigo-gace/modular-catalog`
- URL: `https://github.com/seigo-gace/modular-catalog`
- Branch: `main`
- Work Control: `CHATGPT_WORK_CONTROL.md`
- 圧縮Index: `catalog/index.json`

このRepositoryは特定済みである。毎回Repositoryを検索・一覧取得・再特定せず、GitHub接続Toolから上記RepositoryとPathを直接参照する。名称や場所をマスターへ再確認しない。

## 開発時の運用

1. マスターの現在の指示と、作業対象Projectの指定Repository・最新確定設計・現行Code・README・実測結果を確認する。
2. `seigo-gace/modular-catalog/main/CHATGPT_WORK_CONTROL.md`を直接読み、判断基準を適用する。
3. Code作成前に`seigo-gace/modular-catalog/main/catalog/index.json`だけを直接読む。
4. Indexから目的・責務・言語・Runtime・5段位置・依存・制約が合う候補を絞る。
5. 上位候補の`assets/<id>/meta.json`だけを読み、採用候補の設計・Logic・Architecture・Code・Test・Evidenceから必要Sectionだけを読む。Catalog全体を一括読込しない。
6. 通常テストとユーザー利用テストを通過した資産だけを対象Projectへ取り込み、そのProject条件で再検証する。
7. 適合資産がなければ、`Part → Feature → Component → System → Application System`の論理構造で、次回も再利用できる責務境界を持つ完成Codeを作る。階層ごとのファイル量産や実行時共通Core依存は作らない。
8. 完成・検証済み成果は、Code・設計・Logic・Architecture・両テスト・検証結果・依存・制約・元Repository・Commit・Versionを一体にして固定Repositoryへ登録する。

## 実行とGitHub

- ChatGPTアプリと接続Toolで可能な現物確認、設計、実装、検証、README更新、Commit、Push、反映確認は自分で完了する。
- 作業対象ProjectのRepositoryと`modular-catalog`を混同しない。
- READMEを現物と一致させ、対象差分だけを一つの明確なCommitにまとめる。
- Commitを作業報告の正本とし、変更内容・理由・検証結果・残事項を記録する。
- 指示のないBranch、PR、Pull、force push、履歴変更は行わない。
- 未実行・未確認・未反映を完了済みと報告しない。

## 禁止

現在不要な追加、課題の拡大解釈、工程の中抜き、未完成の完成報告、嘘・捏造・根拠のない断定、不要な複雑化、Catalog Repositoryの再検索、作業対象Projectとの混同を禁止する。
