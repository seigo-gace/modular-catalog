# Logic

安定JSON、Hash、Text、採点補助の決定論的基礎処理を提供する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/quality-completion-evaluator/utils/errors.js`、`src/quality-completion-evaluator/utils/hash.js`、`src/quality-completion-evaluator/utils/load-config.js`、`src/quality-completion-evaluator/utils/scoring.js`、`src/quality-completion-evaluator/utils/stable-json.js`、`src/quality-completion-evaluator/utils/text.js`。
