# 目的
入力を正規化し38 Genreを採点してPrimary・Secondary・Overlayを選択する。
# 範囲
Astera v8内で実稼働・検証済みの当該責務だけを再利用単位として抽出する。
# 責任分担
Featureがこの責務を所有し、上位層は公開契約だけを利用する。
# 構成
元コード `src/domain-template-router.js` を責務境界として使用する。
# 入力
各Sourceが公開する関数、Class、設定、またはHTTP契約。
# 出力
入力を正規化し38 Genreを採点してPrimary・Secondary・Overlayを選択する。
# データ構造
Astera v8の現行ContractとVersionを維持する。
# 処理フロー
入力検証、責務処理、結果返却、必要時の障害通知の順で実行する。
# 判定条件
通常テストとユーザー利用テスト合格後、Astera品質・完成度95点以上かつBlocking 0件だけ掲載する。
# 異常処理
入力不正と依存障害を成功扱いせず、所有する境界から明示的に返す。
# テスト条件
Astera全通常テスト81件と責務に対応する実利用経路を検証する。
# 完成条件
Source一致、二系統テスト合格、Astera判定合格、Manifest整合。
# 実装順序
Partから上位へ依存方向に沿って再構築する。
# 失敗時処理
未掲載のまま問題責務へ差し戻す。
# 再試行
修正後に二系統テストとAstera判定を再実行する。
# Rollback
元Repositoryの検証済みCommitを正本として維持する。
# Archive
旧Versionは削除せずGit履歴で保持する。
# Version
1.1.1
# 変更履歴
Astera v8検証済みCodeから5段責務単位へ再構築した。
# 既知の制限
再利用先Projectへ取り込み、同Project内で依存と動作を再検証する。
# 再評価方法
SourceまたはContract変更時にCandidate Versionを上げて再判定する。
