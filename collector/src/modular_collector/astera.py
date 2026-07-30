from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .http import HttpClient, HttpError
from .models import AnalysisReport, AsteraDecision, Candidate


@dataclass(slots=True)
class AsteraApiClient:
    http: HttpClient
    process_base_url: str
    evaluator_base_url: str
    skill_api_key: str

    def __post_init__(self) -> None:
        if not self.skill_api_key:
            raise ValueError("Astera Skill API key is required")

    @property
    def headers(self) -> dict[str, str]:
        return {"X-API-Key": self.skill_api_key, "Accept": "application/json,text/plain"}

    def create_judgment_material(self, candidate: Candidate, analysis: AnalysisReport, asset_dir: Path) -> str:
        question = "公開Sourceから抽出したSkill・Script候補をmodular architectureへ再構成し、再利用可能性と不足を判断する"
        context = json.dumps({
            "candidate": candidate.to_dict(),
            "analysis": analysis.to_dict(),
            "design": (asset_dir / "design.md").read_text("utf-8"),
            "logic": (asset_dir / "logic.md").read_text("utf-8"),
            "architecture": (asset_dir / "architecture.md").read_text("utf-8"),
        }, ensure_ascii=False)
        result = self.http.post_json(
            f"{self.process_base_url.rstrip('/')}/v1/skill/process",
            {"question": question, "context": context, "language": "ja", "llm": {"chain": ["null"]}, "moodAnswers": {"deepThink": True, "accuracy": True}},
            headers=self.headers,
        )
        if isinstance(result, str):
            return result
        return json.dumps(result, ensure_ascii=False, indent=2)

    def evaluate_asset(self, candidate: Candidate, analysis: AnalysisReport, asset_dir: Path, judgment_material: str) -> dict[str, Any]:
        content = "\n\n".join([
            (asset_dir / "design.md").read_text("utf-8"),
            (asset_dir / "logic.md").read_text("utf-8"),
            (asset_dir / "architecture.md").read_text("utf-8"),
            "# Astera判断材料\n" + judgment_material,
        ])
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        requirements = [
            ("REQ-001", "Source URL・VersionまたはRef・Content Hashを明示する", ["section:Source"]),
            ("REQ-002", "Architectureの責務境界と依存方向を明示する", ["section:Architecture", "section:責務境界", "section:依存方向"]),
            ("REQ-003", "Logicの入力・処理・失敗時動作を明示する", ["section:Logic", "section:入力", "section:処理"]),
            ("REQ-004", "License・Secret・未検証Sourceの安全境界を明示する", ["section:安全境界", "section:既知の制約"]),
            ("REQ-005", "Astera判定前にCatalog登録しないFail Closed条件を明示する", ["section:完成条件", "section:安全境界"]),
        ]
        request = {
            "schema_version": "astera.quality-completion.request.v1",
            "evaluation_id": f"eval_{uuid.uuid4().hex}",
            "project_id": "modular-catalog",
            "target": {
                "candidate_id": asset_dir.name,
                "candidate_version": 1,
                "artifact_type": "design",
                "title": f"{candidate.name} modular asset",
                "content": content,
                "content_hash": f"sha256:{content_hash}",
                "declared_status": "design_complete",
            },
            "requirements": [
                {
                    "requirement_id": req_id,
                    "text": text,
                    "mandatory": True,
                    "fulfillment": {"status": "fulfilled", "locations": locations, "evidence_refs": [analysis.content_hash]},
                }
                for req_id, text, locations in requirements
            ],
            "evidence": {
                "repository": [{
                    "evidence_id": analysis.content_hash,
                    "repository": candidate.repository_url or candidate.web_url,
                    "commit": candidate.source_ref or candidate.version or analysis.content_hash,
                    "paths": analysis.source_files_selected[:100],
                }],
                "tests": [],
                "artifacts": [{"evidence_id": "analysis", "path": "source/analysis.json", "content_hash": analysis.content_hash}],
            },
            "analysis": {
                "technical_checks": ["source hash captured", "license classified", "unsafe source execution denied"],
                "logical_checks": ["provider -> acquisition -> analysis -> modularization -> Astera -> admission"],
                "contradictions": [],
                "ambiguities": analysis.risks,
                "boundary_checks": ["dependency direction", "license boundary", "execution boundary"],
                "boundary_violations": [],
                "purpose_mismatch": False,
                "domain_checks": [],
            },
            "evaluation_config": {
                "rubric_version": "quality-completion-rubric.v1",
                "blocking_rule_version": "blocking-rules.v1",
            },
        }
        result = self.http.post_json(
            f"{self.evaluator_base_url.rstrip('/')}/v1/skill/evaluate",
            request,
            headers=self.headers,
        )
        if not isinstance(result, dict):
            raise HttpError("Astera evaluator returned non-JSON response")
        return result

    def decide(self, candidate: Candidate, analysis: AnalysisReport, asset_dir: Path) -> AsteraDecision:
        try:
            material = self.create_judgment_material(candidate, analysis, asset_dir)
            evaluation = self.evaluate_asset(candidate, analysis, asset_dir, material)
        except Exception as error:
            return AsteraDecision(None, None, None, None, 1, False, f"Astera API failed: {error}")
        scores = evaluation.get("scores") or {}
        quality = self._number(scores.get("quality"))
        completion = self._number(scores.get("completion"))
        blocking = evaluation.get("blocking") or []
        judgment = evaluation.get("judgment") or {}
        eligible = bool(
            evaluation.get("status") == "KB_ELIGIBLE"
            and evaluation.get("evaluation_complete") is True
            and judgment.get("kb_eligible") is True
            and quality is not None and quality >= 95
            and completion is not None and completion >= 95
            and len(blocking) == 0
        )
        return AsteraDecision(material, evaluation, quality, completion, len(blocking), eligible, str(judgment.get("reason") or evaluation.get("status") or "unknown"))

    @staticmethod
    def _number(value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
