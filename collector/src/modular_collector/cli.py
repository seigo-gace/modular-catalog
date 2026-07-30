from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from .http import HttpClient
from .models import SearchQuery
from .pipeline import CollectionPipeline, PipelineConfig


def _load_queries(path: Path) -> list[SearchQuery]:
    data = json.loads(path.read_text("utf-8"))
    if isinstance(data, dict) and "categories" in data:
        defaults = data.get("defaults") or {}
        result: list[SearchQuery] = []
        for category in data["categories"]:
            category_id = str(category["id"])
            target = int(category["target_count"])
            providers = tuple(category.get("providers", defaults.get("providers", ("github", "gitlab", "npm", "pypi", "crates"))))
            limit = int(category.get("limit_per_provider", defaults.get("limit_per_provider", min(100, max(20, target * 2)))))
            stars = int(category.get("minimum_stars", defaults.get("minimum_stars", 0)))
            for keyword in category.get("queries", (category_id,)):
                result.append(SearchQuery(
                    keyword=str(keyword), providers=providers,
                    languages=tuple(category.get("languages", ())),
                    limit_per_provider=limit, minimum_stars=stars,
                    include_archived=bool(category.get("include_archived", False)),
                    category=category_id, target_count=target,
                ))
        return result
    raw = data.get("queries", data) if isinstance(data, dict) else data
    return [SearchQuery(
        keyword=item["keyword"],
        providers=tuple(item.get("providers", ("github", "gitlab", "npm", "pypi", "crates"))),
        languages=tuple(item.get("languages", ())),
        limit_per_provider=int(item.get("limit_per_provider", 10)),
        minimum_stars=int(item.get("minimum_stars", 0)),
        include_archived=bool(item.get("include_archived", False)),
        category=str(item.get("category", "uncategorized")),
        target_count=int(item.get("target_count", item.get("limit_per_provider", 10))),
    ) for item in raw]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="modular-collector")
    sub = parser.add_subparsers(dest="command", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--config", type=Path, required=True)
    common.add_argument("--workspace", type=Path, default=Path("collector-output"))
    common.add_argument("--timeout", type=float, default=30.0)
    search = sub.add_parser("search", parents=[common])
    search.add_argument("--json", action="store_true")
    run = sub.add_parser("run", parents=[common])
    run.add_argument("--process-limit", type=int)
    run.add_argument("--catalog-root", type=Path)
    run.add_argument("--register", action="store_true")
    run.add_argument("--minimum-score", type=int, default=60)
    run.add_argument("--allow-non-permissive", action="store_true")
    run.add_argument("--sync-notion", action="store_true")
    run.add_argument("--max-debug-rounds", type=int, default=3)
    run.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = PipelineConfig(
        workspace=args.workspace,
        catalog_root=getattr(args, "catalog_root", None),
        register_catalog=bool(getattr(args, "register", False)),
        astera_process_url=os.getenv("ASTERA_PROCESS_BASE_URL", os.getenv("ASTERA_API_BASE_URL")),
        astera_evaluator_url=os.getenv("ASTERA_EVALUATOR_BASE_URL", os.getenv("ASTERA_API_BASE_URL")),
        astera_skill_api_key=os.getenv("ASTERA_SKILL_API_KEY"),
        minimum_imitation_score=int(getattr(args, "minimum_score", 60)),
        require_permissive_license=not bool(getattr(args, "allow_non_permissive", False)),
        notion_token=os.getenv("NOTION_TOKEN"),
        notion_data_source_id=os.getenv("NOTION_DATA_SOURCE_ID"),
        sync_notion=bool(getattr(args, "sync_notion", False)),
        max_astera_debug_rounds=int(getattr(args, "max_debug_rounds", 3)),
    )
    pipeline = CollectionPipeline(config, http=HttpClient(timeout_seconds=args.timeout))
    queries = _load_queries(args.config)
    payload = [item.to_dict() for item in (pipeline.search(queries) if args.command == "search" else pipeline.run(queries, process_limit=args.process_limit))]
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"completed: {len(payload)}")
    return 0
