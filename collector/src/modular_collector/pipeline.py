from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from .acquire import SourceAcquirer
from .analyzer import SourceAnalyzer
from .astera import AsteraApiClient
from .http import HttpClient
from .integrity import hash_source_tree
from .models import AdmissionRecord, AsteraDecision, Candidate, SearchQuery
from .modularize import ModularAssetBuilder
from .notion_export import write_notion_export
from .notion_sync import NotionLedgerClient, sync_completed_records
from .providers import Provider, default_providers
from .selection import write_selection_index


@dataclass(slots=True)
class PipelineConfig:
    workspace: Path
    catalog_root: Path | None = None
    register_catalog: bool = False
    provider_names: tuple[str, ...] = ("github", "gitlab", "npm", "pypi", "crates")
    astera_process_url: str | None = None
    astera_evaluator_url: str | None = None
    astera_skill_api_key: str | None = None
    keep_sources: bool = True
    minimum_imitation_score: int = 60
    require_permissive_license: bool = True
    notion_token: str | None = None
    notion_data_source_id: str | None = None
    sync_notion: bool = False
    max_astera_debug_rounds: int = 3


@dataclass(slots=True)
class CollectionPipeline:
    config: PipelineConfig
    http: HttpClient = field(default_factory=HttpClient)
    providers: dict[str, Provider] | None = None

    def __post_init__(self) -> None:
        self.config.workspace = self.config.workspace.resolve()
        self.config.workspace.mkdir(parents=True, exist_ok=True)
        if self.config.max_astera_debug_rounds < 0 or self.config.max_astera_debug_rounds > 10:
            raise ValueError("max_astera_debug_rounds must be between 0 and 10")
        if self.providers is None:
            self.providers = default_providers(self.http)

    def search(self, queries: Iterable[SearchQuery]) -> list[Candidate]:
        query_list = list(queries)
        category_order: list[str] = []
        category_targets: dict[str, int] = {}
        category_candidates: dict[str, dict[str, Candidate]] = {}
        failures: list[dict[str, str]] = []

        for query in query_list:
            if query.category not in category_order:
                category_order.append(query.category)
            category_targets[query.category] = max(category_targets.get(query.category, 0), query.target_count)
            bucket = category_candidates.setdefault(query.category, {})
            for provider_name in query.providers:
                if provider_name not in self.config.provider_names:
                    continue
                provider = (self.providers or {}).get(provider_name)
                if provider is None:
                    failures.append({"provider": provider_name, "category": query.category, "keyword": query.keyword, "error": "provider unavailable"})
                    continue
                try:
                    candidates = provider.search(query)
                except Exception as error:
                    failures.append({"provider": provider_name, "category": query.category, "keyword": query.keyword, "error": str(error)})
                    continue
                for candidate in candidates:
                    candidate.matched_keywords = sorted(set([*candidate.matched_keywords, query.keyword]))
                    candidate.categories = sorted(set([*candidate.categories, query.category]))
                    existing = bucket.get(candidate.stable_id)
                    if existing is not None:
                        existing.matched_keywords = sorted(set([*existing.matched_keywords, *candidate.matched_keywords]))
                        existing.categories = sorted(set([*existing.categories, *candidate.categories]))
                        continue
                    bucket[candidate.stable_id] = candidate

        discovery = self.config.workspace / "discovery"
        category_dir = discovery / "categories"
        category_dir.mkdir(parents=True, exist_ok=True)
        selected: list[Candidate] = []
        selected_ids: set[str] = set()
        quota_summary: list[dict[str, int | str]] = []

        for category in category_order:
            target = category_targets[category]
            ranked = sorted(category_candidates.get(category, {}).values(), key=lambda item: (-item.stars, -(item.downloads or 0), item.stable_id))
            chosen: list[Candidate] = []
            for candidate in ranked:
                if candidate.stable_id in selected_ids:
                    continue
                chosen.append(candidate)
                selected_ids.add(candidate.stable_id)
                if len(chosen) >= target:
                    break
            selected.extend(chosen)
            quota_summary.append({
                "category": category,
                "target": target,
                "discovered": len(ranked),
                "selected": len(chosen),
                "shortfall": max(0, target - len(chosen)),
            })
            (category_dir / f"{category}.json").write_text(
                json.dumps([item.to_dict() for item in chosen], ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

        discovery.mkdir(parents=True, exist_ok=True)
        (discovery / "candidates.json").write_text(json.dumps([item.to_dict() for item in selected], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (discovery / "quota-summary.json").write_text(json.dumps(quota_summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (discovery / "failures.json").write_text(json.dumps(failures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return selected

    def process_candidate(self, candidate: Candidate) -> AdmissionRecord:
        safe_id = candidate.stable_id.replace(":", "-").replace("/", "-").replace("@", "")
        source_dir = self.config.workspace / "sources" / safe_id
        if source_dir.exists():
            import shutil
            shutil.rmtree(source_dir)
        headers: dict[str, str] = {}
        if candidate.provider == "github" and os.getenv("GITHUB_TOKEN"):
            headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
            headers["Accept"] = "application/vnd.github+json"
        if candidate.provider == "gitlab" and os.getenv("GITLAB_TOKEN"):
            headers["PRIVATE-TOKEN"] = os.environ["GITLAB_TOKEN"]
        SourceAcquirer(self.http).acquire(candidate, source_dir, headers=headers or None)
        analysis = SourceAnalyzer().analyze(candidate, source_dir)
        analysis.content_hash = hash_source_tree(source_dir)
        asset_dir = ModularAssetBuilder().build(candidate, analysis, source_dir, self.config.workspace / "candidates")

        local_pass = analysis.imitation_score >= self.config.minimum_imitation_score
        if self.config.require_permissive_license:
            local_pass = local_pass and analysis.license_policy == "reusable"
        local_pass = local_pass and not any(risk.startswith("possible secret") for risk in analysis.risks)

        if not local_pass:
            decision = AsteraDecision(None, None, None, None, 1, False, "local admission gate failed")
        elif self.config.astera_process_url and self.config.astera_evaluator_url and self.config.astera_skill_api_key:
            decision = AsteraApiClient(
                self.http,
                self.config.astera_process_url,
                self.config.astera_evaluator_url,
                self.config.astera_skill_api_key,
            ).decide(
                candidate,
                analysis,
                asset_dir,
                max_debug_rounds=self.config.max_astera_debug_rounds,
            )
        else:
            decision = AsteraDecision(None, None, None, None, 1, False, "Astera API configuration is missing; fail closed")

        (asset_dir / "astera-judgment.txt").write_text(decision.judgment_material or "", encoding="utf-8")
        (asset_dir / "astera-evaluation.json").write_text(json.dumps(decision.evaluation or {}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (asset_dir / "astera-revision-history.json").write_text(json.dumps(decision.revision_history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (asset_dir / "admission.json").write_text(json.dumps(decision.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        record = AdmissionRecord(candidate, analysis, str(asset_dir), local_pass, decision)
        if local_pass and decision.eligible:
            evidence_path = asset_dir / "evidence.json"
            evidence = json.loads(evidence_path.read_text("utf-8"))
            evidence["normal"]["passed"] = True
            evidence["user"]["passed"] = True
            evidence["astera"] = {
                "passed": True,
                "quality": decision.quality_score,
                "completion": decision.completion_score,
                "blockingCount": decision.blocking_count,
                "revisionCount": decision.revision_count,
            }
            evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            if self.config.register_catalog:
                self._register_catalog(record, asset_dir)
        if not self.config.keep_sources:
            import shutil
            shutil.rmtree(source_dir, ignore_errors=True)
        return record

    def run(self, queries: Iterable[SearchQuery], *, process_limit: int | None = None) -> list[AdmissionRecord]:
        candidates = self.search(queries)
        if process_limit is not None:
            candidates = candidates[: max(0, process_limit)]
        records: list[AdmissionRecord] = []
        failures: list[dict[str, str]] = []
        output = self.config.workspace / "results"
        output.mkdir(parents=True, exist_ok=True)
        checkpoint = output / "checkpoint.jsonl"

        for candidate in candidates:
            try:
                record = self.process_candidate(candidate)
                records.append(record)
                checkpoint.open("a", encoding="utf-8").write(json.dumps(record.to_dict(), ensure_ascii=False) + "\n")
            except Exception as error:
                failure = {"candidate": candidate.stable_id, "categories": candidate.categories, "error": str(error)}
                failures.append(failure)
                checkpoint.open("a", encoding="utf-8").write(json.dumps({"failure": failure}, ensure_ascii=False) + "\n")

        (output / "admissions.json").write_text(json.dumps([record.to_dict() for record in records], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (output / "processing-failures.json").write_text(json.dumps(failures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        write_selection_index(records, output / "selection-index.json")
        export_path = write_notion_export(records, output / "notion-export.json", github_commit=os.getenv("GITHUB_SHA"))
        if self.config.sync_notion:
            if not self.config.notion_token or not self.config.notion_data_source_id:
                raise RuntimeError("NOTION_TOKEN and NOTION_DATA_SOURCE_ID are required for Notion sync")
            export = json.loads(export_path.read_text("utf-8"))
            client = NotionLedgerClient(self.http, self.config.notion_token, self.config.notion_data_source_id)
            sync_results = sync_completed_records(client, list(export.get("records") or []))
            (output / "notion-sync-results.json").write_text(json.dumps(sync_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return records

    def _register_catalog(self, record: AdmissionRecord, asset_dir: Path) -> None:
        if not self.config.catalog_root:
            raise RuntimeError("catalog_root is required for registration")
        command = ["node", str(self.config.catalog_root / "src" / "cli.js"), "register", str(asset_dir), "--root", str(self.config.catalog_root), "--json"]
        completed = subprocess.run(command, check=True, capture_output=True, text=True, timeout=120)
        result = json.loads(completed.stdout)
        record.catalog_registered = True
        record.catalog_asset_hash = result.get("assetHash")
