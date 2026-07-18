# Logic

Stripe署名検証、Checkout境界、Subscription状態同期と冪等性を所有する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/billing/key-vault.js`、`src/billing/stripe-client.js`、`src/billing/subscription-sync.js`。
