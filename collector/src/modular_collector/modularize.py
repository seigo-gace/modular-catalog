from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import AnalysisReport, Candidate


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

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        meta = {
            "schemaVersion": 1,
            "id": asset_id,
            "name": f"Open Source Modular Asset: {candidate.name}",
            "version": candidate.version or "0.0.0+source",
            "summary": candidate.description[:500] or f"{candidate.name}から抽出した再利用候補。",
            "purpose": "公開Sourceから再利用可能なArchitecture・Logic・Capabilityを抽出し、責務境界を固定して再利用可能にする。",
            "responsibility": f"{', '.join(analysis.reusable_capabilities[:8]) or '抽出済み責務'}を{analysis.recommended_layer}境界として提供する。",
            "layers": [analysis.recommended_layer],
            "languages": list(analysis.detected_languages) or candidate.languages or ([candidate.primary_language] if candidate.primary_language else ["Other"]),
            "runtimes": self._runtimes(analysis),
            "tags": sorted(set(["open-source", "modular", "collected", candidate.provider, *candidate.matched_keywords, *analysis.architecture_patterns]))[:50],
            "dependencies": analysis.dependencies[:200],
            "constraints": [
                f"upstream license: {analysis.license_spdx or 'unknown'}",
                f"license policy: {analysis.license_policy}",
                "Source更新時は再収集・再解析・Astera再判定を行う",
                "未検証の実行Codeを自動実行しない",
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
        _write_json(asset_dir / "source" / "module-contract.json", self._contract(candidate, analysis))

        self._copy_selected(source_root, asset_dir / "source" / "upstream", analysis)
        (asset_dir / "design.md").write_text(self._design(candidate, analysis), encoding="utf-8")
        (asset_dir / "logic.md").write_text(self._logic(candidate, analysis), encoding="utf-8")
        (asset_dir / "architecture.md").write_text(self._architecture(candidate, analysis), encoding="utf-8")
        _write_json(asset_dir / "evidence.json", {
            "normal": {
                "passed": False,
                "commands": ["python -m unittest discover -s collector/tests -p 'test_*.py'"],
                "expectedResults": ["collector and modular asset contract tests pass"],
            },
            "user": {
                "passed": False,
                "commands": [f"python -m modular_collector inspect {asset_id}"],
                "expectedResults": ["user can inspect provenance, architecture, logic and admission status"],
            },
            "upstream": {
                "testsDetected": analysis.test_files,
                "executionPerformed": False,
                "reason": "untrusted upstream code is not executed by default",
            },
        })
        _write_json(asset_dir / "tests" / "normal" / "verification-plan.json", {
            "checks": ["required files", "source hash", "license policy", "secret scan", "Astera evaluation"],
        })
        _write_json(asset_dir / "tests" / "user" / "journey-plan.json", {
            "journey": ["search", "inspect", "compare", "admit or reject", "Notion sync"],
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
        return runtimes or ["Source-dependent"]

    @staticmethod
    def _contract(candidate: Candidate, analysis: AnalysisReport) -> dict[str, Any]:
        return {
            "schemaVersion": 1,
            "assetKind": "open_source_modular_reference",
            "source": candidate.to_dict(),
            "inputContract": {"type": "source_specific", "entryPoints": analysis.entry_points},
            "outputContract": {"type": "source_specific", "publicSymbols": analysis.public_symbols},
            "responsibilityBoundary": analysis.recommended_layer,
            "capabilities": analysis.reusable_capabilities,
            "architecturePatterns": analysis.architecture_patterns,
            "logicPatterns": analysis.logic_patterns,
            "reusePolicy": analysis.license_policy,
            "executionPolicy": "deny_by_default",
        }

    @staticmethod
    def _design(candidate: Candidate, analysis: AnalysisReport) -> str:
        return f"""# 目的
{candidate.name}から再利用可能なSkill・Script・Architecture・Logicを抽出し、元Sourceへ追跡可能な独立Assetとして保存する。

# Source
- Provider: {candidate.provider}
- URL: {candidate.web_url}
- Repository: {candidate.repository_url or '-'}
- Version/Ref: {candidate.version or candidate.source_ref or '-'}
- Content Hash: {analysis.content_hash}
- License: {analysis.license_spdx or 'unknown'}
- License Policy: {analysis.license_policy}

# 抽出対象
- Languages: {', '.join(analysis.detected_languages) or '-'}
- Entry Points: {', '.join(analysis.entry_points[:20]) or '-'}
- Capabilities: {', '.join(analysis.reusable_capabilities) or '-'}
- Architecture Patterns: {', '.join(analysis.architecture_patterns) or '-'}
- Logic Patterns: {', '.join(analysis.logic_patterns) or '-'}

# 完成条件
1. Source・Version・License・Hashが記録されている。
2. ArchitectureとLogicが責務境界へ再構成されている。
3. 通常Testとユーザー利用Testが合格している。
4. Astera判断材料生成とQualityCompletionEvaluator判定に合格している。
5. 合格前はCatalogへ登録しない。

# 既知の制約
{chr(10).join(f'- {risk}' for risk in analysis.risks) or '- なし'}
"""

    @staticmethod
    def _logic(candidate: Candidate, analysis: AnalysisReport) -> str:
        return f"""# Logic

## 入力
- Keyword: {', '.join(candidate.matched_keywords) or '-'}
- Upstream Source: {candidate.web_url}
- Source Hash: {analysis.content_hash}

## 処理
1. Provider APIで候補を検索する。
2. Source Archiveを安全に取得し、Path Traversal・Symlink・容量上限を検証する。
3. 言語、Manifest、Entry Point、Public Symbol、依存、Test、Documentを抽出する。
4. Pattern検出によりArchitecture・Logic・Capabilityを分類する。
5. LicenseとSecret Riskを検査する。
6. `{analysis.recommended_layer}`責務へ再構成する。
7. Asteraへ設計内容とEvidenceを渡し、95/95・Blocking 0を確認する。
8. 合格時だけCatalogとNotionへ登録する。

## 再利用判断
- Imitation Score: {analysis.imitation_score}
- License Policy: {analysis.license_policy}
- Recommended Layer: {analysis.recommended_layer}
- Fail Closed: 判定不能、License不明、Evidence不足は未登録とする。
"""

    @staticmethod
    def _architecture(candidate: Candidate, analysis: AnalysisReport) -> str:
        return f"""# Architecture

```text
Keyword Search
  -> Provider Adapter ({candidate.provider})
  -> Safe Source Acquisition
  -> Static Source Analyzer
  -> Modular Boundary Builder
  -> Astera Judgment Material API
  -> Astera QualityCompletionEvaluator API
  -> Admission Gate
  -> modular-catalog / Notion Search Index
```

## 責務境界
- Layer: {analysis.recommended_layer}
- Public Entry Points: {', '.join(analysis.entry_points[:30]) or '-'}
- Public Symbols: {', '.join(analysis.public_symbols[:30]) or '-'}
- Dependencies: {', '.join(analysis.dependencies[:50]) or '-'}

## 依存方向
Application System -> System -> Component -> Feature -> Part の下向き依存だけを許可する。外部SourceはRuntime依存にせず、Provenance付きUpstream Snapshotまたは明示Adapterを通す。

## 安全境界
- Sourceは自動実行しない。
- License不明・Secret検出・Hash不一致はBlocking。
- Astera API失敗時はCatalog登録しない。
- NotionにはStatusと判定結果を含めて同期する。
"""
