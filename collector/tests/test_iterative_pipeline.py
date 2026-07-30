from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from modular_collector.astera import AsteraApiClient
from modular_collector.cli import _load_queries
from modular_collector.http import HttpClient
from modular_collector.models import Candidate, SearchQuery
from modular_collector.modularize import ModularAssetBuilder
from modular_collector.pipeline import CollectionPipeline, PipelineConfig
from modular_collector.analyzer import SourceAnalyzer


class SequenceHttp(HttpClient):
    def __init__(self, evaluations):
        super().__init__()
        self.evaluations = list(evaluations)
        self.evaluation_calls = 0
        self.process_calls = 0

    def post_json(self, url, data, *, headers=None):
        if url.endswith("/v1/skill/process"):
            self.process_calls += 1
            return f"Astera material call {self.process_calls}"
        if url.endswith("/v1/skill/evaluate"):
            value = self.evaluations[min(self.evaluation_calls, len(self.evaluations) - 1)]
            self.evaluation_calls += 1
            return value
        raise AssertionError(url)


class CategoryProvider:
    name = "fake"

    def search(self, query):
        return [
            Candidate(
                "fake", f"{query.category}-{index}", f"{query.category}-{index}", "skill", "https://example.test",
                source_url="https://example.test/source.zip", license_spdx="MIT", stars=100 - index,
            )
            for index in range(30)
        ]


class IterativeCollectorTests(unittest.TestCase):
    def fixture(self) -> Path:
        return Path(__file__).parent / "fixtures" / "sample_project"

    def candidate(self) -> Candidate:
        return Candidate(
            "github", "acme/retry-plugin", "acme/retry-plugin", "retry", "https://github.com/acme/retry-plugin",
            repository_url="https://github.com/acme/retry-plugin", source_ref="abc123", license_spdx="MIT",
            matched_keywords=["retry"], categories=["orchestration"],
        )

    def test_collection_plan_total_is_250(self):
        config = Path(__file__).resolve().parents[1] / "skill-collection-250.json"
        queries = _load_queries(config)
        targets = {}
        for query in queries:
            targets[query.category] = query.target_count
        self.assertEqual(sum(targets.values()), 250)
        self.assertEqual(targets["claude-code-models"], 50)
        self.assertEqual(len(targets), 11)

    def test_category_quota_selects_requested_count(self):
        with tempfile.TemporaryDirectory() as temp:
            pipeline = CollectionPipeline(
                PipelineConfig(Path(temp), provider_names=("fake",)),
                providers={"fake": CategoryProvider()},
            )
            found = pipeline.search([
                SearchQuery("one", providers=("fake",), category="token-compression", target_count=20, limit_per_provider=30),
                SearchQuery("two", providers=("fake",), category="japanese-specialized", target_count=20, limit_per_provider=30),
            ])
            self.assertEqual(len(found), 40)
            summary = json.loads((Path(temp) / "discovery" / "quota-summary.json").read_text())
            self.assertEqual(sum(item["selected"] for item in summary), 40)
            self.assertTrue(all(item["shortfall"] == 0 for item in summary))

    def test_reconstruction_contains_all_modular_layers_and_skill(self):
        report = SourceAnalyzer().analyze(self.candidate(), self.fixture())
        with tempfile.TemporaryDirectory() as temp:
            asset = ModularAssetBuilder().build(self.candidate(), report, self.fixture(), Path(temp))
            reconstruction = json.loads((asset / "source" / "reconstruction.json").read_text())
            layers = {item["layer"] for item in reconstruction["hierarchy"]}
            self.assertEqual(layers, {"Part", "Feature", "Component", "System", "Application System"})
            self.assertTrue((asset / "skill.md").exists())
            self.assertIn("Astera 95/95未満", (asset / "skill.md").read_text())

    def test_astera_debugs_below_95_then_re_evaluates(self):
        first = {
            "status": "REVISION_REQUIRED", "evaluation_complete": True,
            "scores": {"quality": 91, "completion": 93}, "blocking": [{"id": "B1"}],
            "judgment": {"kb_eligible": False, "reason": "debug required"},
        }
        second = {
            "status": "KB_ELIGIBLE", "evaluation_complete": True,
            "scores": {"quality": 98, "completion": 97}, "blocking": [],
            "judgment": {"kb_eligible": True, "reason": "passed after debug"},
        }
        http = SequenceHttp([first, second])
        report = SourceAnalyzer().analyze(self.candidate(), self.fixture())
        with tempfile.TemporaryDirectory() as temp:
            asset = ModularAssetBuilder().build(self.candidate(), report, self.fixture(), Path(temp))
            decision = AsteraApiClient(http, "https://astera.test", "https://astera.test", "x" * 32).decide(
                self.candidate(), report, asset, max_debug_rounds=3,
            )
            self.assertTrue(decision.eligible)
            self.assertEqual(decision.revision_count, 1)
            self.assertEqual(http.evaluation_calls, 2)
            self.assertTrue((asset / "revisions" / "round-01.md").exists())
            self.assertIn("Astera Debug補正 Round 1", (asset / "design.md").read_text())


if __name__ == "__main__":
    unittest.main()
