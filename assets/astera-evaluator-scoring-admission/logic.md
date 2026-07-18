# Logic

品質・完成度を個別採点しBlockingと95/95掲載条件を判定する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/quality-completion-evaluator/quality/quality-rule-engine.js`、`src/quality-completion-evaluator/completion/completion-rule-engine.js`、`src/quality-completion-evaluator/blocking/blocking-rule-engine.js`、`src/quality-completion-evaluator/score-calculator.js`、`src/quality-completion-evaluator/kb-admission-gate.js`、`src/quality-completion-evaluator/evaluation-result-builder.js`。
