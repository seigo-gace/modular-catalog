# 目的
Cost/Quota、Retry、Rate limit、Circuit breaker、Backpressure、Checkpoint/Resume、Observability、Availability判定を提供する。

# 境界
純粋関数中心。Tool実行、外部Network、Secret、Git mutation、Deployを所有しない。

# Skill一覧
- `enforceCostBudget`
- `planRetry`
- `guardRateLimit`
- `circuitBreakerDecision`
- `backpressureDecision`
- `buildCheckpoint`
- `resumeFromCheckpoint`
- `captureObservability`
- `assessAvailability`
- `classifyDeadLetter`
