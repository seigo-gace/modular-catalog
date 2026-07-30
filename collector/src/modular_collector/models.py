from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class SearchQuery:
    keyword: str
    providers: tuple[str, ...] = ("github", "gitlab", "npm", "pypi", "crates")
    languages: tuple[str, ...] = ()
    limit_per_provider: int = 10
    minimum_stars: int = 0
    include_archived: bool = False

    def __post_init__(self) -> None:
        if not self.keyword.strip():
            raise ValueError("keyword must not be empty")
        if self.limit_per_provider < 1 or self.limit_per_provider > 100:
            raise ValueError("limit_per_provider must be between 1 and 100")
        if self.minimum_stars < 0:
            raise ValueError("minimum_stars must be >= 0")


@dataclass(slots=True)
class Candidate:
    provider: str
    external_id: str
    name: str
    description: str
    web_url: str
    source_url: str | None = None
    repository_url: str | None = None
    version: str | None = None
    default_branch: str | None = None
    source_ref: str | None = None
    license_spdx: str | None = None
    primary_language: str | None = None
    languages: list[str] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    stars: int = 0
    downloads: int | None = None
    updated_at: str | None = None
    archived: bool = False
    matched_keywords: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def stable_id(self) -> str:
        return f"{self.provider}:{self.external_id}".lower()

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("raw", None)
        data["stable_id"] = self.stable_id
        return data


@dataclass(slots=True)
class AnalysisReport:
    candidate_id: str
    content_hash: str
    file_count: int
    total_bytes: int
    code_files: int
    documentation_files: list[str]
    test_files: list[str]
    manifests: list[str]
    detected_languages: dict[str, int]
    entry_points: list[str]
    public_symbols: list[str]
    dependencies: list[str]
    architecture_patterns: list[str]
    logic_patterns: list[str]
    reusable_capabilities: list[str]
    risks: list[str]
    license_spdx: str | None
    license_policy: str
    imitation_score: int
    recommended_layer: str
    source_files_selected: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class AsteraDecision:
    judgment_material: str | None
    evaluation: dict[str, Any] | None
    quality_score: float | None
    completion_score: float | None
    blocking_count: int
    eligible: bool
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class AdmissionRecord:
    candidate: Candidate
    analysis: AnalysisReport
    asset_directory: str
    local_checks_passed: bool
    astera: AsteraDecision
    catalog_registered: bool = False
    catalog_asset_hash: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidate": self.candidate.to_dict(),
            "analysis": self.analysis.to_dict(),
            "asset_directory": self.asset_directory,
            "local_checks_passed": self.local_checks_passed,
            "astera": self.astera.to_dict(),
            "catalog_registered": self.catalog_registered,
            "catalog_asset_hash": self.catalog_asset_hash,
        }
