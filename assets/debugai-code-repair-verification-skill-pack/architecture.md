# Architecture

論理階層は`Component`。再利用先のRole/Agent/WorkflowからNamed Functionとして呼び出す。

```text
Diagnosis / Evidence / Repository Facts
        ↓
Code Repair Skills
        ↓
Patch Candidate / PatchSet
        ↓
Verification Skills
        ↓
Verification Result / Reject / Blocked
```

- DebugAI本体、AI Core、Router、Workflowを置換しない。
- Tool RuntimeやPatch Apply層へ直接依存しない。
- 呼出側がAdapterで現在のArtifact Contractへ接続する。
- Module Catalogは配布/検索用であり、Runtime依存にしない。
