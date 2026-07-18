# 目的
一般利用者用KeyからアプリGPT Skill専用Keyを分離する。
# 実装
Astera v8で稼働した`src/auth/skill-api-key.js`を同一内容で収録する。
# 入力
候補Keyと環境変数の専用Key・公開Key。
# 出力
設定状態Booleanと認証Identityまたは`null`。
# 異常処理
未設定、長さ違反、公開Key共有、不一致は認証失敗として扱う。
# 設定
`ASTERA_SKILL_API_KEY`、`ASTERA_API_KEY`、後方互換`KAGURA_API_KEY`。
# 起動方法
HTTP Server初期化時にModuleをImportする。
# 停止方法
外部Resourceを持たないため固有停止処理は不要。
# 既存機能との接続
HTTP境界が`X-API-Key`を渡し、成功Identityを処理Contextへ渡す。
# 失敗時処理
設定不正時は専用Endpointを503、認証不一致は401で拒否する。
# 再試行
Secret修正後にProcessを再起動して再試行する。
# Rollback
専用Endpointを停止し専用Keyを失効させる。
# 復旧方法
KeyをRotateし、公開Keyとの非共有を確認して再起動する。
# Version
1.0.0
# 変更履歴
Astera v8実装Commitから同一Codeを抽出した初版。
# 既知の制限
Key保存、配布、Rate Limit、課金、権限認可は対象外。
# 再評価方法
通常Testとユーザー利用Test後、Astera判定を再実行する。
