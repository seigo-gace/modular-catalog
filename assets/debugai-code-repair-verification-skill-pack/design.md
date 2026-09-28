# 目的
DebugAIのCode Repair / Verificationへ追加するSkillを、DebugAI本体から独立した再利用Assetとして保存する。

# 対象Skill
1. `repoPatternReuse` — 既存成功Patternを優先し、新規発明を抑制する。
2. `crossFileDependencyTrace` — 循環を含むCross-file依存を安全に閉包する。
3. `multiFileChangePlanner` — Dependency closure内だけへ変更計画を限定する。
4. `synchronizedPatchsetGenerator` — Required edit/Contract欠落時はApply前にBLOCKEDする。
5. `contextAwareContractCodegen` — TemplateとContract tokenを保持したCode Candidateを作る。
6. `compileFeedbackRepair` — Compile feedbackからCandidate scope内の対象Fileへ局所化する。
7. `semanticDiffReview` — Scope creepとProtected Contract除去を拒否する。
8. `testImpactSelector` — Changed Fileから関連Testを重複なしで選ぶ。
9. `failureToTestTranslator` — Failure ArtifactをRegression Test candidateへ変換する。
10. `regressionTestGenerator` — Repository Test styleへ沿うTest Candidateを生成する。
11. `targetedRegressionStrategy` — Targeted → Adjacent → Full Relevantの順で拡張する。
12. `testFailureInterpreter` — Environment / Flaky / Patch-or-Contract / Unknownを分離する。
13. `falsePassDetector` — skip/assertion mutation/expectation mutation/overmock/error swallowを拒否する。

# 入力・出力
各SkillはPlain Objectを入力し、Plain Objectを返す純粋関数を基本とする。外部I/O、Git操作、Patch Apply、Deployを所有しない。

# 完成条件
- Unit/Invariant TestがPASSする。
- 小型実RepositoryでSkill OFF単一File修正がFAILし、Skill ON Cross-file同期修正がPASSする。
- Compile Errorを実`node --check`で再現し、局所化→修正→Runtime RegressionまでPASSする。
- Cheating Test変更をFalse-passとしてREJECTする。
- Required companion edit欠落をApply前BLOCKする。
