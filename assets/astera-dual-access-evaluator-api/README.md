# Astera Dual Access Evaluator API

## 目的
Astera品質・完成度判定Moduleを本体とは別Processで起動し、一般TenantとアプリGPT Skillの両方へ提供する。
## 対象責務
HTTP受付、二系統認証、一般TenantのPlan別Rate Limit・利用計測、Skill専用無制限経路、判定のみの返却。
## 入力・出力
入力はEvaluation Request JSONと`X-API-Key`。出力はEvaluation Result JSON。掲載処理は行わない。
## 依存関係
Astera `QualityCompletionEvaluator`、TenantManager、RateLimiter、UsageMeter、Logger、SQLiteStore、Safe JSON、Skill API Key認証。
## 使用方法
Codeを互換Astera Projectへ配置し、同じ`ASTERA_DB`と`ASTERA_KEY_PEPPER`を本体と共有して`node api/start.js`で別Process起動する。
## 使用条件・制約
一般Endpointは`/v1/evaluate`、Skill専用は`/v1/skill/evaluate`。既定Port 7374。KBやCatalogへ自動掲載しない。
## 検証内容
一般Tenant認証・利用計測、Plan別Rate Limit、Skill専用認証・無制限、非掲載、1MiB超拒否、独立起動を検証した。
## 元Repository・Commit
`seigo-gace/astera_v8` / `f76a533edace36f82c4685b8eb044e6596732a74`
## Version
1.0.0
