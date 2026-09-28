# 目的
要件Authority保持、Trace、Evidence需要判定、完了条件、Unsupported claim、Fail-closed判定を提供する。

# 境界
純粋関数中心。Tool実行、外部Network、Secret、Git mutation、Deployを所有しない。

# Skill一覧
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
