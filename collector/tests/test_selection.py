from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from modular_collector.models import AdmissionRecord, AnalysisReport, AsteraDecision, Candidate
from modular_collector.selection import (
    SelectionRequest,
    build_selection_profiles,
    load_selection_profiles,
    select_profiles,
    write_selection_index,
)


class SelectionTests(unittest.TestCase):
    def record(self, name: str, category: str, capability: str, *, eligible: bool = True) -> AdmissionRecord:
        candidate = Candidate(
            provider="github",
            external_id=f"acme/{name}",
            name=name,
            description=f"{capability} for production tasks",
            web_url=f"https://github.com/acme/{name}",
            repository_url=f"https://github.com/acme/{name}",
            source_ref="abc123",
            license_spdx="MIT",
            languages=["Python"],
            matched_keywords=[capability],
            categories=[category],
        )
        analysis = AnalysisReport(
            candidate_id=candidate.stable_id,
            content_hash=f"hash-{name}",
            file_count=8,
            total_bytes=200_000,
            code_files=4,
            documentation_files=["README.md"],
            test_files=["tests/test_main.py"],
            manifests=["pyproject.toml"],
            detected_languages={"Python": 4},
            entry_points=["src/main.py", "cli"],
            public_symbols=["run"],
            dependencies=["pydantic"],
            architecture_patterns=["adapter"],
            logic_patterns=["pipeline"],
            reusable_capabilities=[capability],
            risks=[],
            license_spdx="MIT",
            license_policy="reusable",
            imitation_score=90,
            recommended_layer="Component",
            source_files_selected=["src/main.py"],
        )
        decision = AsteraDecision(
            judgment_material="ok",
            evaluation={"status": "KB_ELIGIBLE"} if eligible else {"status": "REVISION_REQUIRED"},
            quality_score=98 if eligible else 90,
            completion_score=97 if eligible else 91,
            blocking_count=0 if eligible else 1,
            eligible=eligible,
            reason="passed" if eligible else "debug required",
        )
        return AdmissionRecord(candidate, analysis, f"/tmp/{name}", eligible, decision)

    def test_profile_contains_selection_contract(self):
        profiles = build_selection_profiles([
            self.record("search-skill", "search-retrieval", "evidence retrieval"),
            self.record("writer-skill", "document-generation", "structured report generation"),
        ])
        search = profiles[0]
        self.assertTrue(search.selectable)
        self.assertIn("search-evidence", search.capability_domains)
        self.assertIn("CLI", search.execution_methods)
        self.assertGreaterEqual(search.base_fitness_score, 80)
        self.assertIn("writer-skill", " ".join(search.compatible_skills))

    def test_selector_ranks_matching_skill_and_excludes_unfinished(self):
        profiles = build_selection_profiles([
            self.record("search-skill", "search-retrieval", "evidence retrieval"),
            self.record("broken-search", "search-retrieval", "evidence retrieval", eligible=False),
            self.record("writer-skill", "document-generation", "structured report generation"),
        ])
        request = SelectionRequest.from_dict({
            "task": "根拠を検索して証拠を集める",
            "required_capabilities": ["evidence retrieval"],
            "preferred_domains": ["search-evidence"],
            "max_results": 5,
        })
        result = select_profiles(profiles, request)
        self.assertEqual(result["decision"], "reuse-existing-skills")
        self.assertEqual(result["selected"][0]["artifact_id"], "search-skill")
        self.assertNotIn("broken-search", [item["artifact_id"] for item in result["selected"]])

    def test_no_match_signals_new_development(self):
        profiles = build_selection_profiles([self.record("writer-skill", "document-generation", "structured report generation")])
        request = SelectionRequest.from_dict({"required_capabilities": ["quantum circuit synthesis"]})
        result = select_profiles(profiles, request)
        self.assertEqual(result["selected"], [])
        self.assertEqual(result["decision"], "new-skill-or-no-existing-skill")

    def test_index_round_trip(self):
        record = self.record("search-skill", "search-retrieval", "evidence retrieval")
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "selection-index.json"
            write_selection_index([record], output)
            profiles = load_selection_profiles(output)
            self.assertEqual(len(profiles), 1)
            data = json.loads(output.read_text("utf-8"))
            self.assertEqual(data["schemaVersion"], 1)

    def test_module_cli_select_entrypoint(self):
        record = self.record("search-skill", "search-retrieval", "evidence retrieval")
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            index = root / "selection-index.json"
            request = root / "request.json"
            output = root / "result.json"
            write_selection_index([record], index)
            request.write_text(json.dumps({
                "task": "evidence retrieval",
                "required_capabilities": ["evidence retrieval"],
                "preferred_domains": ["search-evidence"],
            }), encoding="utf-8")
            env = dict(os.environ)
            env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1] / "src")
            completed = subprocess.run([
                sys.executable, "-m", "modular_collector", "select",
                "--index", str(index), "--request", str(request),
                "--output", str(output), "--json",
            ], check=True, capture_output=True, text=True, env=env)
            result = json.loads(output.read_text("utf-8"))
            self.assertEqual(result["decision"], "reuse-existing-skills")
            self.assertEqual(result["selected"][0]["artifact_id"], "search-skill")
            self.assertIn('"reuse-existing-skills"', completed.stdout)


if __name__ == "__main__":
    unittest.main()
