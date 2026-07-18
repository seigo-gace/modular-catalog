# Logic

一般TenantとアプリGPT専用経路を持つ独立判定APIを提供する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/quality-completion-evaluator/api/server.js`、`src/quality-completion-evaluator/api/start.js`、`src/quality-completion-evaluator/Dockerfile`、`src/quality-completion-evaluator/docker-compose.example.yml`。
