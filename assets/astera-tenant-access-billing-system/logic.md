# Logic

Tenant、Rate Limit、Usage、Subscription、Application状態永続化を運用境界として統合する。

入力を所有境界で検証し、決定論的な規則または明示された外部契約だけで処理する。下位から上位の具象実装を参照せず、失敗を成功値へ変換しない。対象Sourceは`src/store/sqlite-store.js`。
