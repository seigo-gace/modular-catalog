# Logic

任意LLM Providerの生成、HTTP境界、Request・Response変換を統一する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/llm/adapter-base.js`、`src/llm/adapters.js`、`src/llm/http-client.js`、`src/llm/providers/anthropic.js`、`src/llm/providers/null.js`、`src/llm/providers/ollama.js`、`src/llm/providers/openai-compatible.js`、`src/llm/providers/openai.js`。
