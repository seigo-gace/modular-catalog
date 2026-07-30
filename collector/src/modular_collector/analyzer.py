from __future__ import annotations

import ast
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from .models import AnalysisReport, Candidate


LANGUAGE_EXTENSIONS = {
    ".py": "Python", ".pyi": "Python", ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript", ".jsx": "JavaScript", ".go": "Go", ".rs": "Rust",
    ".java": "Java", ".kt": "Kotlin", ".kts": "Kotlin", ".rb": "Ruby", ".php": "PHP", ".swift": "Swift",
    ".cs": "C#", ".c": "C", ".h": "C/C++", ".cc": "C++", ".cpp": "C++", ".hpp": "C++",
    ".sh": "Shell", ".bash": "Shell", ".ps1": "PowerShell", ".lua": "Lua", ".ex": "Elixir", ".exs": "Elixir",
    ".scala": "Scala", ".r": "R", ".dart": "Dart", ".sql": "SQL", ".wasm": "WebAssembly",
}

PERMISSIVE_LICENSES = {"MIT", "APACHE-2.0", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "ISC", "ZLIB", "UNLICENSE"}
NOTICE_LICENSES = {"MPL-2.0", "EPL-2.0", "LGPL-2.1", "LGPL-3.0", "GPL-2.0", "GPL-3.0", "AGPL-3.0"}
SECRET_PATTERNS = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----", re.I),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
]

PATTERN_TOKENS = {
    "adapter": ("adapter", "adaptor"),
    "strategy": ("strategy",),
    "factory": ("factory", "builder"),
    "pipeline": ("pipeline", "workflow", "chain"),
    "plugin": ("plugin", "extension", "hook"),
    "registry": ("registry", "catalog", "index"),
    "cli": ("cli", "command", "argparse", "commander", "cobra"),
    "api": ("api", "router", "endpoint", "handler"),
    "retry": ("retry", "backoff", "circuit breaker"),
    "cache": ("cache", "memo", "ttl"),
    "queue": ("queue", "worker", "job", "outbox"),
    "auth": ("auth", "token", "oauth", "permission"),
    "validator": ("validator", "validation", "schema"),
    "parser": ("parser", "lexer", "tokenizer"),
    "scheduler": ("scheduler", "cron", "schedule"),
    "webhook": ("webhook", "callback", "signature"),
    "event": ("event", "emitter", "pubsub", "subscriber"),
    "state-machine": ("state machine", "transition", "fsm"),
    "worker-pool": ("worker pool", "thread pool", "process pool"),
}


class SourceAnalyzer:
    def __init__(self, *, max_text_file_bytes: int = 2 * 1024 * 1024) -> None:
        self.max_text_file_bytes = max_text_file_bytes

    def analyze(self, candidate: Candidate, source_root: Path) -> AnalysisReport:
        files = sorted(path for path in source_root.rglob("*") if path.is_file() and not path.is_symlink())
        hasher = hashlib.sha256()
        languages: Counter[str] = Counter()
        docs: list[str] = []
        tests: list[str] = []
        manifests: list[str] = []
        entry_points: set[str] = set()
        public_symbols: set[str] = set()
        dependencies: set[str] = set()
        corpus_parts: list[str] = []
        risks: set[str] = set()
        selected: list[str] = []
        total_bytes = 0
        code_files = 0

        for path in files:
            relative = path.relative_to(source_root).as_posix()
            size = path.stat().st_size
            total_bytes += size
            hasher.update(relative.encode("utf-8"))
            hasher.update(size.to_bytes(8, "big", signed=False))
            if path.suffix.lower() in LANGUAGE_EXTENSIONS:
                language = LANGUAGE_EXTENSIONS[path.suffix.lower()]
                languages[language] += 1
                code_files += 1
                if len(selected) < 100:
                    selected.append(relative)
            lowered = relative.lower()
            if self._is_doc(lowered):
                docs.append(relative)
            if self._is_test(lowered):
                tests.append(relative)
            if path.name.lower() in {"package.json", "pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "cargo.toml", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "composer.json", "gemfile"}:
                manifests.append(relative)
            if size == 0 or size > self.max_text_file_bytes:
                continue
            content = path.read_bytes()
            if b"\x00" in content:
                continue
            text = content.decode("utf-8", "replace")
            if any(pattern.search(text) for pattern in SECRET_PATTERNS):
                risks.add(f"possible secret pattern: {relative}")
            corpus_parts.append(f"\n# FILE {relative}\n{text[:100_000]}")
            self._analyze_file(path, relative, text, entry_points, public_symbols, dependencies)

        corpus = "\n".join(corpus_parts).lower()
        architecture_patterns = sorted(name for name, tokens in PATTERN_TOKENS.items() if any(token in corpus for token in tokens))
        logic_patterns = sorted(self._logic_patterns(corpus))
        capabilities = sorted(set(architecture_patterns) | set(logic_patterns) | self._capabilities(corpus))
        license_spdx, policy = self._license(candidate, source_root)
        if not docs:
            risks.add("documentation not detected")
        if not tests:
            risks.add("tests not detected")
        if policy == "blocked":
            risks.add("license is unknown or not approved for source reuse")
        score = self._imitation_score(docs, tests, manifests, architecture_patterns, public_symbols, policy, risks)
        layer = self._layer(architecture_patterns, code_files, len(entry_points))

        return AnalysisReport(
            candidate_id=candidate.stable_id,
            content_hash=f"sha256:{hasher.hexdigest()}",
            file_count=len(files),
            total_bytes=total_bytes,
            code_files=code_files,
            documentation_files=docs[:200],
            test_files=tests[:200],
            manifests=manifests[:100],
            detected_languages=dict(languages.most_common()),
            entry_points=sorted(entry_points)[:500],
            public_symbols=sorted(public_symbols)[:1000],
            dependencies=sorted(dependencies)[:1000],
            architecture_patterns=architecture_patterns,
            logic_patterns=logic_patterns,
            reusable_capabilities=capabilities,
            risks=sorted(risks),
            license_spdx=license_spdx,
            license_policy=policy,
            imitation_score=score,
            recommended_layer=layer,
            source_files_selected=selected,
        )

    @staticmethod
    def _is_doc(relative: str) -> bool:
        name = Path(relative).name.lower()
        return name.startswith(("readme", "architecture", "design", "contributing", "docs")) or "/docs/" in f"/{relative}/" or name in {"skill.md", "usage.md", "examples.md"}

    @staticmethod
    def _is_test(relative: str) -> bool:
        parts = relative.lower().split("/")
        name = parts[-1]
        return any(part in {"test", "tests", "spec", "specs", "__tests__"} for part in parts[:-1]) or bool(re.search(r"(?:^|[._-])(test|spec)(?:[._-]|$)", name))

    def _analyze_file(self, path: Path, relative: str, text: str, entry_points: set[str], public_symbols: set[str], dependencies: set[str]) -> None:
        suffix = path.suffix.lower()
        if path.name == "package.json":
            try:
                package = json.loads(text)
                for key in ("main", "module", "browser", "types", "bin"):
                    value = package.get(key)
                    if isinstance(value, str):
                        entry_points.add(value)
                    elif isinstance(value, dict):
                        entry_points.update(str(item) for item in value.values())
                for key in ("dependencies", "peerDependencies", "optionalDependencies"):
                    dependencies.update((package.get(key) or {}).keys())
            except json.JSONDecodeError:
                pass
        if suffix in {".py", ".pyi"}:
            try:
                tree = ast.parse(text)
            except SyntaxError:
                return
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and not node.name.startswith("_"):
                    public_symbols.add(f"{relative}:{node.name}")
                elif isinstance(node, ast.Import):
                    dependencies.update(alias.name.split(".")[0] for alias in node.names)
                elif isinstance(node, ast.ImportFrom) and node.module:
                    dependencies.add(node.module.split(".")[0])
            if path.name in {"__main__.py", "cli.py", "main.py"}:
                entry_points.add(relative)
        elif suffix in {".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"}:
            for match in re.finditer(r"(?:export\s+)?(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)", text):
                public_symbols.add(f"{relative}:{match.group(1)}")
            for match in re.finditer(r"(?:from\s+|require\s*\(\s*)['\"]([^'\"]+)", text):
                dep = match.group(1)
                if not dep.startswith((".", "/", "node:")):
                    dependencies.add(dep.split("/")[0] if not dep.startswith("@") else "/".join(dep.split("/")[:2]))
            if path.name in {"cli.js", "cli.ts", "index.js", "index.ts", "main.js", "main.ts"}:
                entry_points.add(relative)
        else:
            for match in re.finditer(r"(?:public\s+)?(?:class|interface|struct|trait|func|fn)\s+([A-Za-z_]\w*)", text):
                public_symbols.add(f"{relative}:{match.group(1)}")

    @staticmethod
    def _logic_patterns(corpus: str) -> set[str]:
        patterns: set[str] = set()
        checks = {
            "retry-backoff": ("retry", "backoff"),
            "validation-gate": ("validate", "invalid"),
            "fail-closed": ("deny", "reject", "blocked"),
            "idempotency": ("idempot",),
            "rate-limiting": ("rate limit", "ratelimit"),
            "circuit-breaker": ("circuit breaker", "half_open", "half-open"),
            "event-driven": ("event", "handler"),
            "async-concurrency": ("async", "await"),
            "dependency-injection": ("dependency injection", "inject"),
            "state-transition": ("transition", "state"),
        }
        for name, tokens in checks.items():
            if all(token in corpus for token in tokens):
                patterns.add(name)
        return patterns

    @staticmethod
    def _capabilities(corpus: str) -> set[str]:
        mapping = {
            "HTTP integration": ("http", "request"),
            "command-line interface": ("command", "option"),
            "configuration loading": ("config", "environment"),
            "structured logging": ("logger", "json"),
            "persistence": ("database", "sqlite"),
            "authentication": ("auth", "token"),
            "source analysis": ("parser", "source"),
            "artifact generation": ("generate", "artifact"),
        }
        return {name for name, tokens in mapping.items() if all(token in corpus for token in tokens)}

    @staticmethod
    def _normalize_license(value: str | None) -> str | None:
        if not value:
            return None
        normalized = re.sub(r"\s+", "-", value.strip().upper())
        aliases = {
            "APACHE-2": "APACHE-2.0", "APACHE-2.0-LICENSE": "APACHE-2.0", "MIT-LICENSE": "MIT",
            "BSD-3": "BSD-3-CLAUSE", "BSD-2": "BSD-2-CLAUSE",
        }
        return aliases.get(normalized, normalized)

    def _license(self, candidate: Candidate, source_root: Path) -> tuple[str | None, str]:
        declared = self._normalize_license(candidate.license_spdx)
        detected = declared
        if not detected:
            for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"):
                path = source_root / name
                if not path.exists() or path.stat().st_size > self.max_text_file_bytes:
                    continue
                text = path.read_text("utf-8", "replace").upper()
                if "MIT LICENSE" in text:
                    detected = "MIT"
                elif "APACHE LICENSE" in text and "2.0" in text:
                    detected = "APACHE-2.0"
                elif "GNU AFFERO" in text:
                    detected = "AGPL-3.0"
                elif "GNU GENERAL PUBLIC LICENSE" in text:
                    detected = "GPL-3.0"
                elif "MOZILLA PUBLIC LICENSE" in text:
                    detected = "MPL-2.0"
                elif "BSD" in text:
                    detected = "BSD-3-CLAUSE"
                break
        if detected in PERMISSIVE_LICENSES:
            return detected, "reusable"
        if detected in NOTICE_LICENSES:
            return detected, "reference_or_notice_required"
        return detected, "blocked"

    @staticmethod
    def _imitation_score(docs: list[str], tests: list[str], manifests: list[str], patterns: list[str], symbols: set[str], policy: str, risks: set[str]) -> int:
        score = 30
        score += min(15, len(docs) * 3)
        score += min(20, len(tests) * 2)
        score += min(10, len(manifests) * 3)
        score += min(20, len(patterns) * 2)
        score += min(10, len(symbols) * 2)
        if policy == "reusable":
            score += 10
        elif policy == "reference_or_notice_required":
            score += 3
        score -= min(35, len(risks) * 7)
        return max(0, min(100, score))

    @staticmethod
    def _layer(patterns: list[str], code_files: int, entry_points: int) -> str:
        if code_files <= 3 and entry_points <= 1:
            return "Part"
        if code_files <= 20:
            return "Feature"
        if any(pattern in patterns for pattern in ("pipeline", "plugin", "registry", "adapter")):
            return "Component"
        if code_files > 250:
            return "Application System"
        return "System"
