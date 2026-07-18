# Logic

入力検証から採点、Blocking、候補Record生成までを一つの判定契約で統合する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/quality-completion-evaluator/evaluator-engine.js`、`src/quality-completion-evaluator/index.js`、`src/quality-completion-evaluator/integration/create-evaluation-packet.js`、`src/quality-completion-evaluator/integration/astera-kb-admission-hook.js`、`src/quality-completion-evaluator/adapters/kb-system-adapter.js`、`src/quality-completion-evaluator/adapters/in-memory-kb-adapter.js`、`src/quality-completion-evaluator/adapters/http-kb-system-adapter.js`。
