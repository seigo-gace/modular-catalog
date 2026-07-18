# Logic

任意Provider ChainとFallback順序を運用可能な出力境界として提供する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/llm/llm-client.js`。
