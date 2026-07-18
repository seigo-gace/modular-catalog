# Logic

`/v1/evaluate`は本体と同じTenant Keyを解決しPlan別Rate Limitと利用計測を適用する。`/v1/skill/evaluate`は専用Keyだけを認証しRate Limit・課金計測を適用しない。両経路は同じEvaluatorの`evaluate`を呼び、保存Adapterを呼ばない。
