# G-ACE Requirement Authority & Completion Skill Pack

Notion Skill Matrix由来の再利用可能なG-ACE独自実装。外部候補Repositoryのコードはコピーしていない。

## Skills
- `preserveRequirementAuthority`
- `traceRequirements`
- `detectEvidenceNeeds`
- `buildCapabilityRequest`
- `resolveSkillBinding`
- `buildCompletionConditions`
- `detectUnsupportedClaims`
- `preserveSourceAuthority`
- `buildRegressionHooks`
- `failClosedCompletionGate`

## Verify
```bash
node --test tests/normal/*.cjs tests/user/*.cjs
```
