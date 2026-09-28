# Logic

## Candidate-only
Skillは変更候補、計画、検証結果だけを返し、実File mutation権限を所有しない。

## Fail-closed
Evidence/Template/Contract/Required editが不足する場合は、推測でREADYへ昇格せず`BLOCKED`または`UNKNOWN`を返す。

## Cross-file Repair
Root fileからDependency closureを作り、必要変更をclosure内へ限定し、Required editとContract条件が全て揃った時だけPatchSetを`READY`にする。

## Verification
変更FileからTest impactを選び、FailureをRegression candidateへ変換し、Targeted→Adjacent→Full Relevantへ段階拡張する。Environment/FlakyをPatch defectと混同しない。

## False-pass
Test skip、Assertion/Expectationの都合の良い書換え、過剰Mock、Error握り潰しを成功扱いしない。
