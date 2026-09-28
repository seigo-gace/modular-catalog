# G-ACE Architecture & Adversarial Skill Pack

Notion Skill Matrix由来の再利用可能なG-ACE独自実装。外部候補Repositoryのコードはコピーしていない。

## Skills
- `extractInvariants`
- `findNegativeSpace`
- `buildDependencyGraph`
- `detectDependencyCycles`
- `designInterfaceBoundary`
- `analyzeDataFlow`
- `checkCrossDocumentConsistency`
- `buildFailureRecoveryPlan`
- `generateCounterexamples`
- `exploreFailureModes`
- `traceRisks`
- `buildRollbackPlan`

## Verify
```bash
node --test tests/normal/*.cjs tests/user/*.cjs
```
