# Astera Cognition Orchestration

## 目的
Astera v8のComponent責務を次回開発で再利用可能にする。
## 対象責務
Router、5本柱、Dialectic、Compare、8段判断材料の実行順序を統合する。
## 入力・出力
入力は公開契約、出力は責務の処理結果。
## 依存関係
Feature and Part assets named by the source imports
## 使用方法
`source/`を対象Projectへ取り込み、Import契約を接続する。
## 使用条件・制約
ModuleCatalogへの実行時依存を作らない。再利用先Project内で二系統テストを再実行する。元SourceのLicenseと利用条件を維持する。
## 検証内容
Astera通常テスト52件、Evaluator 29件、Evaluator API 4件、およびAsset Source一致検証。
## 元Repository・Commit
`seigo-gace/astera_v8` / `f76a533edace36f82c4685b8eb044e6596732a74`
## Version
1.1.1
