# Astera Skill API Key Authentication

## 目的

Asteraの一般API Keyと、アプリGPTがSkill経由で使用する専用PRIVATE API Keyを分離して認証する。

## 対象責務

`ASTERA_SKILL_API_KEY`の設定妥当性、公開Keyとの非共有、一定時間比較、専用Identity返却。

## 入力・出力

- 入力: `X-API-Key`値と環境変数`ASTERA_SKILL_API_KEY`、`ASTERA_API_KEY`または`KAGURA_API_KEY`
- 出力: 認証成功時の専用Identity、失敗時の`null`、設定状態Boolean

## 依存関係

Node.js標準`node:crypto`。

## 使用方法

`isSkillApiConfigured()`でEndpoint有効状態を確認し、`authenticateSkillApiKey(req.headers['x-api-key'])`で認証する。

## 使用条件・制約

専用Keyは32〜256文字とし、公開Keyと共有しない。Secretは環境変数またはSecret Storeから注入し、Code・Log・Responseへ記録しない。

## 検証内容

Astera v8本体で欠落、不一致、公開Tenant Key、短Key、公開Key共有、正常認証、Rate Limit・課金非適用を検証。Asset内でも通常Testとユーザー利用Testを再実行する。

## 元Repository・Commit

`seigo-gace/astera_v8` / `f76a533edace36f82c4685b8eb044e6596732a74`

## Version

1.0.0
