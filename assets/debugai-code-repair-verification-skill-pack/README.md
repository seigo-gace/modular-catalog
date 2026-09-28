# DebugAI Code Repair & Verification Skill Pack

DebugAI向けに先行ローカル検証した13 Skillを、再利用可能なNamed FunctionとしてまとめたAssetです。

## Source
`source/index.js`

## Test
```bash
node --test tests/normal/future-skills.test.cjs tests/normal/invariant-fuzz.test.cjs
node --test tests/user/integration-e2e.test.cjs
```

## Verified boundary
ローカルSkill Engineと小型実Repositoryでの効果を検証済み。現在のDebugAI AI Coreへ接続した実LLM Skill ON/OFF A/Bは未実施であり、実Model効果PASSを主張しません。
