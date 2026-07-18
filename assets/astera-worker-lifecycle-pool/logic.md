# Logic

Worker割当、Timeout、Crash時の一度だけの再生成を管理する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/worker-pool.js`。
