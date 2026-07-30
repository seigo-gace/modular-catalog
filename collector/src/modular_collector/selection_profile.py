from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

from .models import AdmissionRecord
from .skill_taxonomy import DOMAIN_COMPATIBILITY, domains_for, load_taxonomy, unique


@dataclass(slots=True)
class SelectionProfile:
    artifact_id: str
    name: str
    source_id: str
    capability_domains: list[str]
    categories: list[str]
    capabilities: list[str]
    problem_solved: str
    input_contract: str
    output_contract: str
    strength_conditions: list[str]
    constraint_conditions: list[str]
    execution_methods: list[str]
    dependencies: list[str]
    speed_profile: str
    cost_profile: str
    compatible_domains: list[str]
    compatible_skills: list[str]
    selection_keywords: list[str]
    quality_score: float | None
    completion_score: float | None
    evidence_count: int
    base_fitness_score: float
    selectable: bool
    selection_readiness: str
    module_path: str
    source_url: str
    content_hash: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def execution_methods(record: AdmissionRecord) -> list[str]:
    analysis = record.analysis
    methods = ["Skill Contract", "Library" if analysis.code_files else "Logic Blueprint"]
    entry = " ".join(analysis.entry_points).casefold()
    patterns = " ".join([*analysis.architecture_patterns, *analysis.logic_patterns]).casefold()
    if any(x in entry for x in ("cli", "__main__", "command", "/bin/", "console")):
        methods.append("CLI")
    if any(x in patterns for x in ("api", "adapter", "client", "webhook", "connector")):
        methods.append("API Adapter")
    language_map = {
        "Python": "Python Module", "JavaScript": "Node.js Module", "TypeScript": "Node.js Module",
        "Go": "Go Module", "Rust": "Rust Crate", "Java": "JVM Module", "Kotlin": "JVM Module",
        "C#": ".NET Module", "Shell": "Shell Script", "PowerShell": "Shell Script",
    }
    languages = set(analysis.detected_languages) | set(record.candidate.languages)
    methods.extend(language_map.get(language, "") for language in languages)
    return unique(methods, 20)


def resource_profiles(record: AdmissionRecord) -> tuple[str, str]:
    analysis = record.analysis
    weight = analysis.total_bytes + len(analysis.dependencies) * 50_000 + analysis.code_files * 20_000
    return ("low", "low") if weight <= 2_000_000 else (("medium", "medium") if weight <= 20_000_000 else ("high", "high"))


def fitness(record: AdmissionRecord, evidence_count: int) -> float:
    decision = record.astera
    score = (
        float(decision.quality_score or 0) * .35
        + float(decision.completion_score or 0) * .25
        + float(max(0, min(100, record.analysis.imitation_score))) * .20
        + float(min(100, evidence_count * 10)) * .20
    )
    score -= min(20, len(record.analysis.risks) * 4)
    if record.analysis.license_policy != "reusable":
        score -= 30
    if not decision.eligible:
        score = min(score, 59.9)
    return round(max(0, min(100, score)), 2)


def build_selection_profile(record: AdmissionRecord, taxonomy: dict[str, Any] | None = None) -> SelectionProfile:
    taxonomy = taxonomy or load_taxonomy()
    candidate, analysis, decision = record.candidate, record.analysis, record.astera
    domains = domains_for(candidate.categories, taxonomy)
    compatibility = taxonomy.get("domainCompatibility") or DOMAIN_COMPATIBILITY
    compatible_domains = unique(target for domain in domains for target in compatibility.get(domain, []))
    evidence_count = len(analysis.documentation_files) + len(analysis.test_files) + len(analysis.source_files_selected)
    speed, cost = resource_profiles(record)
    strengths = []
    if analysis.test_files:
        strengths.append("Upstream test assets detected")
    if analysis.documentation_files:
        strengths.append("Documentation assets detected")
    if analysis.imitation_score >= 80:
        strengths.append("Clear reusable responsibility boundary")
    if len(analysis.dependencies) <= 10:
        strengths.append("Low dependency count")
    if decision.eligible:
        strengths.append("Astera 95/95 and zero blocking passed")
    constraints = [*analysis.risks]
    if not analysis.test_files:
        constraints.append("No upstream test asset detected")
    if not analysis.documentation_files:
        constraints.append("No upstream documentation asset detected")
    constraints += [f"License policy: {analysis.license_policy}", "Upstream source is not auto-executed"]
    capabilities = unique(analysis.reusable_capabilities, 100)
    problem = candidate.description.strip() or (f"{', '.join(capabilities[:5])}を再利用可能なSkillとして提供する。" if capabilities else "Sourceから抽出した責務を再利用可能にする。")
    input_contract = "Task purpose; target data/source; constraints; success conditions; evidence requirements"
    if analysis.entry_points:
        input_contract += f"; entry points: {', '.join(analysis.entry_points[:20])}"
    output_contract = "Completed result; used Parts/Features; evidence; constraints and unresolved items"
    if analysis.public_symbols:
        output_contract += f"; public symbols: {', '.join(analysis.public_symbols[:20])}"
    keywords = unique([
        *candidate.categories, *candidate.matched_keywords, *candidate.topics, *domains, *capabilities,
        *analysis.architecture_patterns, *analysis.logic_patterns, *analysis.detected_languages.keys(),
    ], 100)
    selectable = bool(record.local_checks_passed and decision.eligible and decision.blocking_count == 0 and (decision.quality_score or 0) >= 95 and (decision.completion_score or 0) >= 95)
    return SelectionProfile(
        Path(record.asset_directory).name, f"{candidate.provider}｜{candidate.name}", candidate.stable_id,
        domains, unique(candidate.categories), capabilities, problem[:2000], input_contract[:2000], output_contract[:2000],
        unique(strengths, 50), unique(constraints, 50), execution_methods(record), unique(analysis.dependencies, 100),
        speed, cost, compatible_domains, [], keywords, decision.quality_score, decision.completion_score,
        evidence_count, fitness(record, evidence_count), selectable,
        "ready" if selectable else ("revision-required" if decision.evaluation else "blocked"),
        record.asset_directory, candidate.web_url, analysis.content_hash,
    )


def compatibility_score(left: SelectionProfile, right: SelectionProfile) -> float:
    if left.artifact_id == right.artifact_id or not right.selectable:
        return -1
    return (
        len(set(left.compatible_domains) & set(right.capability_domains)) * 15
        + len(set(left.capability_domains) & set(right.capability_domains)) * 8
        + len(set(left.categories) & set(right.categories)) * 4
        + right.base_fitness_score / 20
    )


def build_selection_profiles(records: Iterable[AdmissionRecord], taxonomy: dict[str, Any] | None = None) -> list[SelectionProfile]:
    taxonomy = taxonomy or load_taxonomy()
    profiles = [build_selection_profile(record, taxonomy) for record in records]
    for profile in profiles:
        ranked = sorted(((other.artifact_id, compatibility_score(profile, other)) for other in profiles), key=lambda x: (-x[1], x[0]))
        profile.compatible_skills = [asset for asset, score in ranked if score > 0][:20]
    return profiles


def write_selection_index(records: Iterable[AdmissionRecord], destination: Path, taxonomy: dict[str, Any] | None = None) -> Path:
    profiles = build_selection_profiles(records, taxonomy)
    for profile in profiles:
        asset_dir = Path(profile.module_path)
        if asset_dir.is_dir():
            (asset_dir / "selection-profile.json").write_text(json.dumps(profile.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({"schemaVersion": 1, "profiles": [p.to_dict() for p in profiles]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination


def load_selection_profiles(path: Path) -> list[SelectionProfile]:
    data = json.loads(path.read_text("utf-8"))
    rows = data.get("profiles", data) if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise ValueError("selection index must contain a profiles array")
    return [SelectionProfile(**row) for row in rows]
