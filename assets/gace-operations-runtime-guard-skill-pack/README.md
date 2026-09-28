# G-ACE Operations & Runtime Guard Skill Pack

Notion Skill Matrix由来の再利用可能なG-ACE独自実装。外部候補Repositoryのコードはコピーしていない。

## Skills
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

## Verify
```bash
node --test tests/normal/*.cjs tests/user/*.cjs
```
