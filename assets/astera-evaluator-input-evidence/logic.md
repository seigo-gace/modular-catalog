# Logic

判定入力、要求対応、証拠整合、Repository現物を検証する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/quality-completion-evaluator/input-validator.js`、`src/quality-completion-evaluator/requirement-mapper.js`、`src/quality-completion-evaluator/evidence-verifier.js`、`src/quality-completion-evaluator/utils/repository.js`。
