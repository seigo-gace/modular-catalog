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
    queries = data.get("queries", data) if isinstance(data, dict) else data
    return [SearchQuery(
        keyword=item["keyword"],
        providers=tuple(item.get("providers", ("github", "gitlab", "npm", "pypi", "crates"))),
        languages=tuple(item.get("languages", ())),
        limit_per_provider=int(item.get("limit_per_provider", 10)),
        minimum_stars=int(item.get("minimum_stars", 0)),
        include_archived=bool(item.get("include_archived", False)),
    ) for item in queries]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="modular-collector", description="Collect and modularize open-source Skills and Scripts.")
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
    run.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    queries = _load_queries(args.config)
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
    )
    pipeline = CollectionPipeline(config, http=HttpClient(timeout_seconds=args.timeout))
    if args.command == "search":
        candidates = pipeline.search(queries)
        payload = [candidate.to_dict() for candidate in candidates]
    else:
        records = pipeline.run(queries, process_limit=args.process_limit)
        payload = [record.to_dict() for record in records]
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"completed: {len(payload)}")
    return 0
