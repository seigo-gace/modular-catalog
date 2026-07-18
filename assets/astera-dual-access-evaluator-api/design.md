# 目的
Astera判定Moduleを本体と別APIとして一般ユーザーとアプリGPT Skillへ提供する。
# 実装
Astera v8で稼働したAPI Server、起動Entry、Docker定義を同一内容で収録する。
# 入力
Evaluation Request JSON、Tenant KeyまたはSkill専用Key。
# 出力
Evaluation Result JSON。保存・掲載の副作用は持たない。
# 異常処理
未認証401、設定不正503、Rate超過429、CORS拒否403、Payload超過413、内部障害500。
# 設定
`ASTERA_DB`、`ASTERA_KEY_PEPPER`、`ASTERA_SKILL_API_KEY`、Evaluator Host・Port・CORS。
# 起動方法
`node api/start.js`またはDocker Composeで本体と別Process起動する。
# 停止方法
SIGINT・SIGTERMでHTTP Server、Store、Loggerを順に停止する。
# 既存機能との接続
本体発行Tenant Keyと同じDB・Pepperを使い、既存Evaluatorの`evaluate`だけを呼ぶ。
# 失敗時処理
判定失敗を監査Logへ残し、掲載せずエラーResponseを返す。
# 再試行
入力・設定・依存障害を修正し、同一候補を再評価する。
# Rollback
別API Processを停止し、旧CLI判定経路を維持する。
# 復旧方法
共有DB、Secret、Port、Logを確認し判定APIだけを再起動する。
# Version
1.0.0
# 変更履歴
Astera v8実装Commitから別API Systemを抽出した初版。
# 既知の制限
一般Tenant Key発行はAstera本体が担当する。自動掲載を提供しない。
# 再評価方法
互換Astera Projectへ取り込み通常Test・ユーザー利用Test後にAstera判定する。
