# 目的
Query planning、Source authority/freshness、Claim-Evidence mapping、Conflict/Citation/Gap/Scope判定を提供する。

# 境界
純粋関数中心。Tool実行、外部Network、Secret、Git mutation、Deployを所有しない。

# Skill一覧
- `planQueries`
- `evaluateSourceAuthority`
- `checkFreshness`
- `extractClaims`
- `mapClaimsToEvidence`
- `detectContradictorySources`
- `verifyCitations`
- `detectEvidenceGaps`
- `scopeEvidence`
- `mergeEvidenceResults`
