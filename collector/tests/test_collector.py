from __future__ import annotations

import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from modular_collector.acquire import AcquisitionError, SourceAcquirer
from modular_collector.analyzer import SourceAnalyzer
from modular_collector.astera import AsteraApiClient
from modular_collector.http import HttpClient
from modular_collector.models import Candidate, SearchQuery
from modular_collector.modularize import ModularAssetBuilder
from modular_collector.pipeline import CollectionPipeline, PipelineConfig
from modular_collector.providers import GitHubProvider, NpmProvider


class FakeHttp(HttpClient):
    def __init__(self, responses):
        super().__init__()
        self.responses = responses
        self.posts = []

    def get_json(self, url, *, headers=None):
        value = self.responses[url]
        return value() if callable(value) else value

    def request(self, url, *, method="GET", headers=None, body=None):
        value = self.responses[url]
        if isinstance(value, tuple):
            return value
        return 200, {"Content-Type": "application/json"}, json.dumps(value).encode()

    def post_json(self, url, data, *, headers=None):
        self.posts.append((url, data, headers))
        value = self.responses[url]
        return value() if callable(value) else value


class ProviderTests(unittest.TestCase):
    def test_github_search_maps_repository(self):
        url = "https://api.github.com/search/repositories?q=retry+stars%3A%3E%3D5+archived%3Afalse&sort=stars&order=desc&per_page=3"
        http = FakeHttp({url: {"items": [{
            "id": 1, "full_name": "acme/retry", "description": "retry adapter", "html_url": "https://github.com/acme/retry",
            "archive_url": "https://api.github.com/repos/acme/retry/{archive_format}{/ref}", "clone_url": "https://github.com/acme/retry.git",
            "default_branch": "main", "license": {"spdx_id": "MIT"}, "language": "Go", "topics": ["retry"],
            "stargazers_count": 100, "updated_at": "2026-01-01T00:00:00Z", "archived": False,
        }]}})
        result = GitHubProvider(http).search(SearchQuery("retry", providers=("github",), limit_per_provider=3, minimum_stars=5))
        self.assertEqual(result[0].stable_id, "github:acme/retry")
        self.assertEqual(result[0].license_spdx, "MIT")
        self.assertIn("zipball/main", result[0].source_url)

    def test_npm_search_maps_package(self):
        url = "https://registry.npmjs.org/-/v1/search?text=plugin&size=2"
        http = FakeHttp({url: {"objects": [{"package": {"name": "plug", "version": "1.0.0", "description": "plugin", "links": {"npm": "https://npmjs.com/plug"}, "keywords": ["plugin"]}}]}})
        result = NpmProvider(http).search(SearchQuery("plugin", providers=("npm",), limit_per_provider=2))
        self.assertEqual(result[0].name, "plug")
        self.assertEqual(result[0].primary_language, "JavaScript")


class AcquisitionTests(unittest.TestCase):
    def test_zip_path_traversal_is_rejected(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("../escape.txt", "bad")
        http = FakeHttp({"https://example.test/source.zip": (200, {"Content-Type": "application/zip"}, buffer.getvalue())})
        candidate = Candidate("github", "x/y", "x/y", "", "https://example.test", source_url="https://example.test/source.zip")
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(AcquisitionError):
                SourceAcquirer(http).acquire(candidate, Path(temp) / "source")


class AnalyzerTests(unittest.TestCase):
    def fixture(self) -> Path:
        return Path(__file__).parent / "fixtures" / "sample_project"

    def candidate(self) -> Candidate:
        return Candidate("github", "acme/retry-plugin", "acme/retry-plugin", "retry", "https://github.com/acme/retry-plugin", repository_url="https://github.com/acme/retry-plugin", source_ref="abc123", license_spdx="MIT", matched_keywords=["retry"])

    def test_analyzer_extracts_language_patterns_and_license(self):
        report = SourceAnalyzer().analyze(self.candidate(), self.fixture())
        self.assertEqual(report.detected_languages["Python"], 2)
        self.assertIn("adapter", report.architecture_patterns)
        self.assertIn("retry", report.architecture_patterns)
        self.assertEqual(report.license_policy, "reusable")
        self.assertGreaterEqual(report.imitation_score, 60)

    def test_modular_builder_generates_catalog_candidate(self):
        report = SourceAnalyzer().analyze(self.candidate(), self.fixture())
        with tempfile.TemporaryDirectory() as temp:
            asset = ModularAssetBuilder().build(self.candidate(), report, self.fixture(), Path(temp))
            self.assertTrue((asset / "meta.json").exists())
            self.assertTrue((asset / "source" / "module-contract.json").exists())
            evidence = json.loads((asset / "evidence.json").read_text())
            self.assertFalse(evidence["normal"]["passed"])


class AsteraTests(unittest.TestCase):
    def test_astera_decision_requires_95_95_and_zero_blocking(self):
        process_url = "https://astera.test/v1/skill/process"
        eval_url = "https://eval.test/v1/skill/evaluate"
        http = FakeHttp({
            process_url: "01 本当の目的\n...\n08 主役AIへの再指示",
            eval_url: {
                "status": "KB_ELIGIBLE", "evaluation_complete": True,
                "scores": {"quality": 98, "completion": 97}, "blocking": [],
                "judgment": {"kb_eligible": True, "reason": "passed"},
            },
        })
        fixture = Path(__file__).parent / "fixtures" / "sample_project"
        candidate = Candidate("github", "acme/retry-plugin", "acme/retry-plugin", "retry", "https://github.com/acme/retry-plugin", repository_url="https://github.com/acme/retry-plugin", source_ref="abc123", license_spdx="MIT", matched_keywords=["retry"])
        report = SourceAnalyzer().analyze(candidate, fixture)
        with tempfile.TemporaryDirectory() as temp:
            asset = ModularAssetBuilder().build(candidate, report, fixture, Path(temp))
            decision = AsteraApiClient(http, "https://astera.test", "https://eval.test", "x" * 32).decide(candidate, report, asset)
            self.assertTrue(decision.eligible)
            self.assertEqual(decision.blocking_count, 0)

    def test_astera_decision_rejects_below_threshold(self):
        process_url = "https://astera.test/v1/skill/process"
        eval_url = "https://eval.test/v1/skill/evaluate"
        http = FakeHttp({
            process_url: "judgment",
            eval_url: {
                "status": "REVISION_REQUIRED", "evaluation_complete": True,
                "scores": {"quality": 94, "completion": 100}, "blocking": [],
                "judgment": {"kb_eligible": False, "reason": "quality below 95"},
            },
        })
        fixture = Path(__file__).parent / "fixtures" / "sample_project"
        candidate = Candidate("github", "acme/retry-plugin", "acme/retry-plugin", "retry", "https://github.com/acme/retry-plugin", repository_url="https://github.com/acme/retry-plugin", source_ref="abc123", license_spdx="MIT", matched_keywords=["retry"])
        report = SourceAnalyzer().analyze(candidate, fixture)
        with tempfile.TemporaryDirectory() as temp:
            asset = ModularAssetBuilder().build(candidate, report, fixture, Path(temp))
            decision = AsteraApiClient(http, "https://astera.test", "https://eval.test", "x" * 32).decide(candidate, report, asset)
            self.assertFalse(decision.eligible)
            self.assertEqual(decision.quality_score, 94)


class FakeProvider:
    name = "fake"

    def __init__(self, candidates):
        self.candidates = candidates

    def search(self, query):
        for candidate in self.candidates:
            candidate.matched_keywords.append(query.keyword)
        return self.candidates


class PipelineTests(unittest.TestCase):
    def test_full_pipeline_modularizes_and_astera_marks_eligible(self):
        fixture = Path(__file__).parent / "fixtures" / "sample_project"
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            for path in fixture.rglob("*"):
                if path.is_file():
                    archive.write(path, f"sample/{path.relative_to(fixture).as_posix()}")
        source_url = "https://example.test/sample.zip"
        process_url = "https://astera.test/v1/skill/process"
        eval_url = "https://eval.test/v1/skill/evaluate"
        http = FakeHttp({
            source_url: (200, {"Content-Type": "application/zip"}, buffer.getvalue()),
            process_url: "01 本当の目的\n...\n08 主役AIへの再指示",
            eval_url: {
                "status": "KB_ELIGIBLE", "evaluation_complete": True,
                "scores": {"quality": 100, "completion": 100}, "blocking": [],
                "judgment": {"kb_eligible": True, "reason": "passed"},
            },
        })
        candidate = Candidate("github", "acme/retry-plugin", "acme/retry-plugin", "retry", "https://github.com/acme/retry-plugin", source_url=source_url, repository_url="https://github.com/acme/retry-plugin", source_ref="abc123", license_spdx="MIT", matched_keywords=["retry"])
        with tempfile.TemporaryDirectory() as temp:
            pipeline = CollectionPipeline(PipelineConfig(
                Path(temp), provider_names=("fake",), astera_process_url="https://astera.test",
                astera_evaluator_url="https://eval.test", astera_skill_api_key="x" * 32,
            ), http=http, providers={"fake": FakeProvider([candidate])})
            record = pipeline.process_candidate(candidate)
            self.assertTrue(record.local_checks_passed)
            self.assertTrue(record.astera.eligible)
            evidence = json.loads((Path(record.asset_directory) / "evidence.json").read_text())
            self.assertTrue(evidence["normal"]["passed"])
            self.assertTrue(evidence["user"]["passed"])

    def test_search_deduplicates_across_keywords(self):
        candidate = Candidate("fake", "same", "same", "", "https://example.test")
        with tempfile.TemporaryDirectory() as temp:
            pipeline = CollectionPipeline(PipelineConfig(Path(temp), provider_names=("fake",)), providers={"fake": FakeProvider([candidate])})
            found = pipeline.search([SearchQuery("one", providers=("fake",)), SearchQuery("two", providers=("fake",))])
            self.assertEqual(len(found), 1)
            self.assertEqual(found[0].matched_keywords, ["one", "two"])


if __name__ == "__main__":
    unittest.main()
