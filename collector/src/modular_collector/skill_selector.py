from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable

from .selection_profile import SelectionProfile, load_selection_profiles
from .skill_taxonomy import unique

_LEVELS = {"low": 0, "medium": 1, "high": 2}
_TOKEN_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._+\-]{1,}|[\u3040-\u30ff\u3400-\u9fff]{2,}")


def tokens(*values: Any) -> set[str]:
    result: set[str] = set()
    for value in values:
        if isinstance(value, (list, tuple, set)):
            result.update(tokens(*value))
        else:
            result.update(match.group(0) for match in _TOKEN_RE.finditer(str(value or "").casefold()))
    return result


@dataclass(slots=True)
class SelectionRequest:
    task: str
    required_capabilities: list[str] = field(default_factory=list)
    preferred_domains: list[str] = field(default_factory=list)
    preferred_categories: list[str] = field(default_factory=list)
    execution_methods: list[str] = field(default_factory=list)
    avoid_constraints: list[str] = field(default_factory=list)
    max_speed_profile: str | None = None
    max_cost_profile: str | None = None
    min_quality: float = 95.0
    min_completion: float = 95.0
    max_results: int = 10
    require_selectable: bool = True

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SelectionRequest:
        request = cls(
            str(data.get("task") or "").strip(), unique(data.get("required_capabilities") or []),
            unique(data.get("preferred_domains") or []), unique(data.get("preferred_categories") or []),
            unique(data.get("execution_methods") or []), unique(data.get("avoid_constraints") or []),
            data.get("max_speed_profile"), data.get("max_cost_profile"),
            float(data.get("min_quality", 95)), float(data.get("min_completion", 95)),
            int(data.get("max_results", 10)), bool(data.get("require_selectable", True)),
        )
        if not request.task and not request.required_capabilities and not request.preferred_domains:
            raise ValueError("selection request requires task, required_capabilities, or preferred_domains")
        if request.max_results < 1 or request.max_results > 100:
            raise ValueError("max_results must be between 1 and 100")
        for name, value in (("max_speed_profile", request.max_speed_profile), ("max_cost_profile", request.max_cost_profile)):
            if value is not None and value not in _LEVELS:
                raise ValueError(f"{name} must be low, medium, or high")
        return request

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def within_level(value: str, maximum: str | None) -> bool:
    return maximum is None or _LEVELS.get(value, 99) <= _LEVELS[maximum]


def select_profiles(profiles: Iterable[SelectionProfile], request: SelectionRequest) -> dict[str, Any]:
    profile_list = list(profiles)
    request_tokens, required_tokens = tokens(request.task, request.required_capabilities), tokens(request.required_capabilities)
    preferred_domains, preferred_categories = set(request.preferred_domains), set(request.preferred_categories)
    required_methods = {x.casefold() for x in request.execution_methods}
    avoid_tokens = tokens(request.avoid_constraints)
    ranked: list[dict[str, Any]] = []
    for profile in profile_list:
        if request.require_selectable and not profile.selectable:
            continue
        if (profile.quality_score or 0) < request.min_quality or (profile.completion_score or 0) < request.min_completion:
            continue
        if not within_level(profile.speed_profile, request.max_speed_profile) or not within_level(profile.cost_profile, request.max_cost_profile):
            continue
        methods = {x.casefold() for x in profile.execution_methods}
        if required_methods and not required_methods.issubset(methods):
            continue
        profile_tokens = tokens(profile.problem_solved, profile.capabilities, profile.selection_keywords, profile.input_contract, profile.output_contract)
        capability_overlap = required_tokens & profile_tokens
        if required_tokens and not capability_overlap:
            continue
        if avoid_tokens & tokens(profile.constraint_conditions):
            continue
        task_overlap = request_tokens & profile_tokens
        domain_overlap = preferred_domains & set(profile.capability_domains)
        category_overlap = preferred_categories & set(profile.categories)
        score = profile.base_fitness_score * .45 + min(30, len(task_overlap) * 3) + min(30, len(capability_overlap) * 6) + len(domain_overlap) * 12 + len(category_overlap) * 8 + (5 if required_methods else 0)
        reasons = [f"base fitness {profile.base_fitness_score}"]
        if capability_overlap:
            reasons.append(f"required capability match: {', '.join(sorted(capability_overlap)[:10])}")
        if domain_overlap:
            reasons.append(f"domain match: {', '.join(sorted(domain_overlap))}")
        if category_overlap:
            reasons.append(f"category match: {', '.join(sorted(category_overlap))}")
        if task_overlap:
            reasons.append(f"task keyword match: {', '.join(sorted(task_overlap)[:10])}")
        ranked.append({"score": round(score, 2), "artifact_id": profile.artifact_id, "name": profile.name, "reasons": reasons, "profile": profile.to_dict()})
    ranked.sort(key=lambda x: (-x["score"], -x["profile"]["base_fitness_score"], x["artifact_id"]))
    selected = ranked[:request.max_results]
    for index, item in enumerate(selected, 1):
        item["rank"] = index
    steps: list[dict[str, Any]] = []
    if selected:
        compatible = set(selected[0]["profile"].get("compatible_skills") or [])
        for index, item in enumerate(selected):
            role = "primary" if index == 0 else ("compatible-support" if item["artifact_id"] in compatible else "alternative")
            steps.append({"order": index + 1, "artifact_id": item["artifact_id"], "role": role, "module_path": item["profile"]["module_path"], "execution_methods": item["profile"]["execution_methods"]})
    return {
        "schemaVersion": 1, "request": request.to_dict(), "selected": selected,
        "decision": "reuse-existing-skills" if selected else "new-skill-or-no-existing-skill",
        "compositionPlan": {"mode": "reuse-and-compose" if selected else "new-development-required", "steps": steps},
        "searchedProfiles": len(profile_list),
    }


def select_from_files(index_path: Path, request_path: Path, destination: Path | None = None) -> dict[str, Any]:
    result = select_profiles(load_selection_profiles(index_path), SelectionRequest.from_dict(json.loads(request_path.read_text("utf-8"))))
    if destination is not None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result
