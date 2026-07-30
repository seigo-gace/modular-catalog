from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import AnalysisReport, Candidate


LAYERS = ("Part", "Feature", "Component", "System", "Application System")


def _slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if len(normalized) < 3:
        normalized = f"asset-{hashlib.sha256(value.encode()).hexdigest()[:12]}"
    return normalized[:80].strip("-")


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class ModularAssetBuilder:
    def build(self, candidate: Candidate, analysis: AnalysisReport, source_root: Path, destination_root: Path) -> Path:
        asset_id = _slug(f"oss-{candidate.provider}-{candidate.name}")
        asset_dir = destination_root / asset_id
        if asset_dir.exists():
            shutil.rmtree(asset_dir)
        (asset_dir / "source" / "upstream").mkdir(parents=True)
        (asset_dir / "tests" / "normal").mkdir(parents=True)
        (asset_dir / "tests" / "user").mkdir(parents=True)
        (asset_dir / "revisions").mkdir(parents=True)

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        reconstruction = self._reconstruction(asset_id, candidate, analysis)
        meta = {
            "schemaVersion": 2,
            "id": asset_id,
            "name": f"Open Source Reconstructed Skill: {candidate.name}",
            "version": candidate.version or "0.0.0+source",
            "summary": candidate.description[:500] or f"{candidate.name}から抽出・再開発したSkill。",
            "purpose": "公開SourceのArchitecture・Logic・Capabilityを分解し、独立した再利用Skillとして新規再構築する。",
            "responsibility": f"{', '.join(analysis.reusable_capabilities[:8]) or '抽出済み責務'}を検証可能なSkill Contractとして提供する。",
            "layers": list(LAYERS),
            "primaryLayer": analysis.recommended_layer,
            "languages": list(analysis.detected_languages) or candidate.languages or ([candidate.primary_language] if candidate.primary_language else ["Other"]),
            "runtimes": self._runtimes(analysis),
            "categories": candidate.categories,
            "tags": sorted(set(["open-source", "modular", "reconstructed-skill", candidate.provider, *candidate.categories, *candidate.matched_keywords, *analysis.architecture_patterns]))[:80],
            "dependencies": analysis.dependencies[:200],
            "constraints": [
                f"upstream license: {analysis.license_spdx or 'unknown'}",
                f"license policy: {analysis.license_policy}",
                "Source更新時は再収集・再解析・Astera再判定を行う",
                "未検証のUpstream Codeを自動実行しない",
                "Astera 95/95・Blocking 0未満は完成扱いにしない",
            ],
            "source": {
                "repository": candidate.repository_url or candidate.web_url,
                "commit": candidate.source_ref or candidate.version or analysis.content_hash,
            },
            "verifiedAt": now,
        }
        _write_json(asset_dir / "meta.json", meta)
        _write_json(asset_dir / "source" / "analysis.json", analysis.to_dict())
        _write_json(asset_dir / "source" / "provenance.json", candidate.to_dict())
        _write_json(asset_dir / "source" / "module-contract.json", self._contract(asset_id, candidate, analysis, reconstruction))
        _write_json(asset_dir / "source" / "reconstruction.json", reconstruction)

        self._copy_selected(source_root, asset_dir / "source" / "upstream", analysis)
        (asset_dir / "skill.md").write_text(self._skill(candidate, analysis, reconstruction), encoding="utf-8")
        (asset_dir / "design.md").write_text(self._design(candidate, analysis, reconstruction), encoding="utf-8")
        (asset_dir / "logic.md").write_text(self._logic(candidate, analysis, reconstruction), encoding="utf-8")
        (asset_dir / "architecture.md").write_text(self._architecture(candidate, analysis, reconstruction), encoding="utf-8")
        _write_json(asset_dir / "evidence.json", {
            "normal": {
                "passed": False,
                "commands": ["python -m unittest discover -s collector/tests -p 'test_*.py'"],
                "expectedResults": ["collector, reconstruction and admission contract tests pass"],
            },
            "user": {
                "passed": False,
                "commands": [f"inspect generated asset {asset_id}"],
                "expectedResults": ["skill, provenance, modular hierarchy, architecture, logic and admission are inspectable"],
            },
            "upstream": {
                "testsDetected": analysis.test_files,
                "executionPerformed": False,
                "reason": "untrusted upstream code is not executed by default",
            },
        })
        _write_json(asset_dir / "tests" / "normal" / "verification-plan.json", {
            "checks": ["required files", "five-layer hierarchy", "source hash", "license policy", "secret scan", "Astera iterative evaluation"],
        })
        _write_json(asset_dir / "tests" / "user" / "journey-plan.json", {
            "journey": ["search", "decompose", "reconstruct", "Astera evaluate", "debug if below 95", "re-evaluate", "admit", "Notion sync"],
        })
        return asset_dir

    @staticmethod
    def _copy_selected(source_root: Path, destination: Path, analysis: AnalysisReport) -> None:
        for relative in analysis.source_files_selected:
            source = source_root / relative
            if not source.is_file() or source.is_symlink():
                continue
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "README.md", "README.rst", "README"):
            source = source_root / name
            if source.is_file() and not source.is_symlink():
                target = destination / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)

    @staticmethod
    def _runtimes(analysis: AnalysisReport) -> list[str]:
        mapping = {
            "Python": "Python 3.11+", "JavaScript": "Node.js", "TypeScript": "Node.js", "Rust": "Rust",
            "Go": "Go", "Java": "JVM", "Kotlin": "JVM", "C#": ".NET", "Ruby": "Ruby", "PHP": "PHP",
        }
        runtimes = sorted({mapping[language] for language in analysis.detected_languages if language in mapping})
        return runtimes or ["Source-independent Skill Contract"]

    @staticmethod
    def _reconstruction(asset_id: str, candidate: Candidate, analysis: AnalysisReport) -> dict[str, Any]:
        capabilities = analysis.reusable_capabilities or ["source-derived-capability"]
        parts = [
            {
                "id": f"{asset_id}-part-{index + 1}",
                "layer": "Part",
                "responsibility": capability,
                "inputs": analysis.entry_points[:10],
                "outputs": analysis.public_symbols[:10],
            }
            for index, capability in enumerate(capabilities[:20])
        ]
        feature = {
            "id": f"{asset_id}-feature",
            "layer": "Feature",
            "responsibility": "抽出したPartを一つの利用可能なSkill動作へ統合する",
            "children": [part["id"] for part in parts],
        }
        component = {
            "id": f"{asset_id}-component",
            "layer": "Component",
            "responsibility": "入力検証、Skill実行、Evidence出力、失敗制御を提供する",
            "children": [feature["id"]],
        }
        system = {
            "id": f"{asset_id}-system",
            "layer": "System",
            "responsibility": "カテゴリ別Skillとして検索・選択・実行可能にする",
            "categories": candidate.categories,
            "children": [component["id"]],
        }
        application = {
            "id": f"{asset_id}-application-system",
            "layer": "Application System",
            "responsibility": "AI実行基盤から呼び出せる完成済み再利用Skillとして提供する",
            "children": [system["id"]],
        }
        return {
            "schemaVersion": 1,
            "mode": "decompose-and-rebuild" if analysis.code_files else "build-from-logic",
            "sourceCandidate": candidate.stable_id,
            "primaryLayer": analysis.recommended_layer,
            "hierarchy": [*parts, feature, component, system, application],
            "logicPatterns": analysis.logic_patterns,
            "architecturePatterns": analysis.architecture_patterns,
            "completionGate": {
                "qualityMinimum": 95,
                "completionMinimum": 95,
                "blockingMaximum": 0,
                "debugAndReevaluateBelowThreshold": True,
            },
        }

    @staticmethod
    def _contract(asset_id: str, candidate: Candidate, analysis: AnalysisReport, reconstruction: dict[str, Any]) -> dict[str, Any]:
        return {
            "schemaVersion": 2,
            "assetKind": "newly_reconstructed_skill",
            "source": candidate.to_dict(),
            "inputContract": {"type": "skill_input", "entryPoints": analysis.entry_points},
            "outputContract": {"type": "skill_result_with_evidence", "publicSymbols": analysis.public_symbols},
            "responsibilityBoundary": analysis.recommended_layer,
            "capabilities": analysis.reusable_capabilities,
            "architecturePatterns": analysis.architecture_patterns,
            "logicPatterns": analysis.logic_patterns,
            "modularHierarchy": reconstruction["hierarchy"],
            "rootApplicationSystem": f"{asset_id}-application-system",
            "reusePolicy": analysis.license_policy,
            "executionPolicy": "deny_upstream_execution_by_default",
            "admissionPolicy": "Astera 95/95 and zero blocking after iterative debug",
        }

    @staticmethod
    def _skill(candidate: Candidate, analysis: AnalysisReport, reconstruction: dict[str, Any]) -> str:
        capabilities = "\n".join(f"- {item}" for item in analysis.reusable_capabilities) or "- Sourceから抽出した主要能力"
        return f"""# {candidate.name} Reconstructed Skill

## 発動条件
- カテゴリ: {', '.join(candidate.categories) or 'uncategorized'}
- Keyword: {', '.join(candidate.matched_keywords) or '-'}
- 次の能力が必要なTaskで選択する。
{capabilities}

## 入力
- Task目的
- 対象DataまたはSource
- 制約、成功条件、Evidence要求

## 実行
1. 入力と成功条件を検証する。
2. Part単位の責務へ分解する。
3. Feature、Component、System、Application Systemの順に統合する。
4. {', '.join(analysis.logic_patterns) or '抽出済みLogic'}を適用する。
5. 出力とEvidenceを照合する。
6. 失敗・不明・矛盾は成功扱いにしない。

## 出力
- 完成結果
- 使用したPart／Feature
- Evidence
- 制約と未解決事項

## 安全境界
- Upstream Codeは自動実行しない。
- License、Secret、Hash、Evidence、Astera判定を通過しないものは再利用しない。
- Astera 95/95未満またはBlockingありはDebugして再判定する。

## Source
- {candidate.web_url}
- Hash: {analysis.content_hash}
- Reconstruction mode: {reconstruction['mode']}
"""

    @staticmethod
    def _design(candidate: Candidate, analysis: AnalysisReport, reconstruction: dict[str, Any]) -> str:
        return f"""# 目的
{candidate.name}からArchitecture・Logic・Capabilityを分解し、元Sourceへ追跡可能な独立Skillとして新規再構築する。

# Source
- Provider: {candidate.provider}
- URL: {candidate.web_url}
- Repository: {candidate.repository_url or '-'}
- Version/Ref: {candidate.version or candidate.source_ref or '-'}
- Content Hash: {analysis.content_hash}
- License: {analysis.license_spdx or 'unknown'}
- License Policy: {analysis.license_policy}

# 実行境界
- Server Deployment: false
- Runtime: GitHub ActionsまたはAI Assistant一時実行環境
- Astera Usage: API only

# 抽出対象
- Categories: {', '.join(candidate.categories) or '-'}
- Languages: {', '.join(analysis.detected_languages) or '-'}
- Entry Points: {', '.join(analysis.entry_points[:20]) or '-'}
- Capabilities: {', '.join(analysis.reusable_capabilities) or '-'}
- Architecture Patterns: {', '.join(analysis.architecture_patterns) or '-'}
- Logic Patterns: {', '.join(analysis.logic_patterns) or '-'}
- Reconstruction Mode: {reconstruction['mode']}

# Modular Architecture
Part → Feature → Component → System → Application Systemの全階層を`source/reconstruction.json`へ保存する。

# 完成条件
1. Source・Version・License・Hashが記録されている。
2. ArchitectureとLogicが全階層へ再構成されている。
3. `skill.md`として独立した新規Skillが生成されている。
4. 通常Testとユーザー利用Testが合格している。
5. Astera判断材料生成とQualityCompletionEvaluator判定に合格している。
6. QualityまたはCompletionが95未満、あるいはBlockingありの場合はAstera Debugを行い再判定する。
7. 合格前はCatalog・Notion完成台帳へ登録しない。

# 既知の制約
{chr(10).join(f'- {risk}' for risk in analysis.risks) or '- なし'}
"""

    @staticmethod
    def _logic(candidate: Candidate, analysis: AnalysisReport, reconstruction: dict[str, Any]) -> str:
        return f"""# Logic

## 入力
- Category: {', '.join(candidate.categories) or '-'}
- Keyword: {', '.join(candidate.matched_keywords) or '-'}
- Upstream Source: {candidate.web_url}
- Source Hash: {analysis.content_hash}

## 処理
1. Provider APIでカテゴリQuotaに基づき候補を検索する。
2. Source Archiveを安全に取得し、Path Traversal・Symlink・容量上限を検証する。
3. 言語、Manifest、Entry Point、Public Symbol、依存、Test、Documentを抽出する。
4. Architecture・Logic・CapabilityをPart単位へ分解する。
5. Part → Feature → Component → System → Application Systemへ再構築する。
6. `skill.md`、Contract、Design、Logic、Architecture、Evidenceを新規生成する。
7. LicenseとSecret Riskを検査する。
8. Asteraへ完成物とEvidenceを渡して判定する。
9. Quality／Completion 95未満またはBlockingありはAstera Debugを適用し、再構築して再判定する。
10. 合格時だけCatalogと指定Notion台帳へ登録する。

## 再利用判断
- Imitation Score: {analysis.imitation_score}
- License Policy: {analysis.license_policy}
- Primary Layer: {analysis.recommended_layer}
- Reconstruction Mode: {reconstruction['mode']}
- Fail Closed: 判定不能、License不明、Evidence不足、Debug上限到達は未登録とする。
"""

    @staticmethod
    def _architecture(candidate: Candidate, analysis: AnalysisReport, reconstruction: dict[str, Any]) -> str:
        return f"""# Architecture

```text
Category Quota Search
  -> Provider Adapter ({candidate.provider})
  -> Safe Source Acquisition
  -> Static Source Analyzer
  -> Part Decomposer / Logic Builder
  -> Five-layer Modular Reconstructor
  -> New Skill Artifact Builder
  -> Astera Judgment Material API
  -> Astera QualityCompletionEvaluator API
  -> [below 95 or blocking] Astera Debug -> Rebuild -> Re-evaluate
  -> Admission Gate
  -> Specified Notion Search Ledger
  -> Optional modular-catalog Registration Adapter
```

## 責務境界
- Primary Layer: {analysis.recommended_layer}
- Full Hierarchy: Part → Feature → Component → System → Application System
- Public Entry Points: {', '.join(analysis.entry_points[:30]) or '-'}
- Public Symbols: {', '.join(analysis.public_symbols[:30]) or '-'}
- Dependencies: {', '.join(analysis.dependencies[:50]) or '-'}

## 依存方向
Application System -> System -> Component -> Feature -> Part の下向き依存だけを許可する。外部SourceはRuntime依存にせず、Provenance付きSnapshotまたは明示Adapterを通す。

## Astera Debug Loop
最大設定回数まで、評価結果とBlockingを判断材料生成APIへ戻し、Design・Logic・Architecture・Skill Contractを補正して再評価する。95/95・Blocking 0以外は完成扱いにしない。

## 安全境界
- Sourceは自動実行しない。
- License不明・Secret検出・Hash不一致はBlocking。
- Astera API失敗時はCatalog・Notion完成台帳へ登録しない。
- Notionには完成結果、Category、Revision回数、判定結果を同期する。
"""
