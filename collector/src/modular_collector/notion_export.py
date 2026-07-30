from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import AdmissionRecord
from .selection import SelectionProfile, build_selection_profiles


def notion_properties(
    record: AdmissionRecord,
    *,
    github_commit: str | None = None,
    selection_profile: SelectionProfile | None = None,
) -> dict[str, Any]:
    candidate = record.candidate
    analysis = record.analysis
    decision = record.astera
    profile = selection_profile or build_selection_profiles([record])[0]
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
        "Tags": sorted(set([
            candidate.provider,
            "open-source",
            "modular",
            "reconstructed-skill",
            *candidate.categories,
            *candidate.matched_keywords,
            *analysis.architecture_patterns,
            *profile.capability_domains,
        ]))[:30],
        "Source URL": candidate.web_url,
        "Source Version": candidate.version or candidate.source_ref or "",
        "License": analysis.license_spdx or "unknown",
        "Content Hash": analysis.content_hash,
        "GitHub Commit": github_commit or "",
        "Quality Score": decision.quality_score,
        "Completion Score": decision.completion_score,
        "Evidence Count": profile.evidence_count,
        "Risk Level": risk,
        "Admission Passed": bool(decision.eligible),
        "Last Validated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "Notes": notes,
        "Capability Domains": profile.capability_domains,
        "Problem Solved": profile.problem_solved,
        "Input Contract": profile.input_contract,
        "Output Contract": profile.output_contract,
        "Strength Conditions": "; ".join(profile.strength_conditions),
        "Constraint Conditions": "; ".join(profile.constraint_conditions),
        "Execution Methods": profile.execution_methods,
        "Dependencies": ", ".join(profile.dependencies),
        "Speed Profile": profile.speed_profile,
        "Cost Profile": profile.cost_profile,
        "Compatible Domains": profile.compatible_domains,
        "Compatible Skills": ", ".join(profile.compatible_skills),
        "Selection Keywords": ", ".join(profile.selection_keywords),
        "Base Fitness Score": profile.base_fitness_score,
        "Selectable": profile.selectable,
        "Selection Readiness": profile.selection_readiness,
    }


def write_notion_export(records: list[AdmissionRecord], destination: Path, *, github_commit: str | None = None) -> Path:
    profiles = build_selection_profiles(records)
    payload = {
        "schemaVersion": 3,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "records": [
            notion_properties(record, github_commit=github_commit, selection_profile=profile)
            for record, profile in zip(records, profiles, strict=True)
        ],
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination
