from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import AdmissionRecord


def notion_properties(record: AdmissionRecord, *, github_commit: str | None = None) -> dict[str, Any]:
    candidate = record.candidate
    analysis = record.analysis
    decision = record.astera
    languages = list(analysis.detected_languages) or candidate.languages
    status = "完了" if decision.eligible else ("進行中" if decision.evaluation else "未着手")
    risk = "low"
    if analysis.license_policy == "blocked" or decision.blocking_count:
        risk = "blocked"
    elif analysis.risks:
        risk = "medium"
    notes = (
        f"categories={','.join(candidate.categories) or 'uncategorized'}; "
        f"revision_count={decision.revision_count}; "
        f"catalog_registered={record.catalog_registered}; reason={decision.reason}"
    )
    return {
        "Name": f"{candidate.provider}｜{candidate.name}",
        "Artifact Type": "Skill",
        "Language": languages,
        "Status": status,
        "Repository": candidate.repository_url or candidate.web_url,
        "Module Path": record.asset_directory,
        "Entry Point": ", ".join(analysis.entry_points[:20]),
        "Capabilities": ", ".join(analysis.reusable_capabilities),
        "Tags": sorted(set([candidate.provider, "open-source", "modular", "reconstructed-skill", *candidate.categories, *candidate.matched_keywords, *analysis.architecture_patterns]))[:30],
        "Source URL": candidate.web_url,
        "Source Version": candidate.version or candidate.source_ref or "",
        "License": analysis.license_spdx or "unknown",
        "Content Hash": analysis.content_hash,
        "GitHub Commit": github_commit or "",
        "Quality Score": decision.quality_score,
        "Completion Score": decision.completion_score,
        "Evidence Count": len(analysis.documentation_files) + len(analysis.test_files) + len(analysis.source_files_selected),
        "Risk Level": risk,
        "Admission Passed": bool(decision.eligible),
        "Last Validated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "Notes": notes,
    }


def write_notion_export(records: list[AdmissionRecord], destination: Path, *, github_commit: str | None = None) -> Path:
    payload = {
        "schemaVersion": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "records": [notion_properties(record, github_commit=github_commit) for record in records],
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination
