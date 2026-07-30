from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

DOMAIN_IDS = (
    "understanding-analysis", "search-evidence", "compression-context",
    "reasoning-planning-decision", "language-japanese", "document-content",
    "code-software-engineering", "testing-debug-quality", "data-processing-analytics",
    "memory-kb-rag", "agent-orchestration", "api-tool-integration",
    "automation-long-running", "infrastructure-reliability", "security-risk",
    "ai-model-specific", "ui-ux-design", "business-domain-operations",
)

CATEGORY_DOMAIN_MAP = {
    "token-compression": ["compression-context"],
    "language-processing": ["language-japanese"],
    "japanese-specialized": ["language-japanese"],
    "document-generation": ["document-content"],
    "context-management": ["compression-context", "memory-kb-rag"],
    "prompt-compression": ["compression-context"],
    "long-running": ["automation-long-running", "memory-kb-rag"],
    "orchestration": ["agent-orchestration", "reasoning-planning-decision"],
    "code-generation": ["code-software-engineering", "testing-debug-quality"],
    "search-retrieval": ["search-evidence", "memory-kb-rag"],
    "claude-code-models": ["ai-model-specific", "code-software-engineering", "agent-orchestration"],
}

DOMAIN_COMPATIBILITY = {
    "understanding-analysis": ["search-evidence", "reasoning-planning-decision", "document-content"],
    "search-evidence": ["understanding-analysis", "reasoning-planning-decision", "memory-kb-rag", "document-content"],
    "compression-context": ["memory-kb-rag", "language-japanese", "agent-orchestration", "ai-model-specific"],
    "reasoning-planning-decision": ["search-evidence", "agent-orchestration", "data-processing-analytics"],
    "language-japanese": ["document-content", "compression-context", "business-domain-operations"],
    "document-content": ["language-japanese", "search-evidence", "data-processing-analytics", "ui-ux-design"],
    "code-software-engineering": ["testing-debug-quality", "api-tool-integration", "infrastructure-reliability", "security-risk"],
    "testing-debug-quality": ["code-software-engineering", "security-risk", "infrastructure-reliability"],
    "data-processing-analytics": ["search-evidence", "reasoning-planning-decision", "document-content"],
    "memory-kb-rag": ["search-evidence", "compression-context", "agent-orchestration"],
    "agent-orchestration": ["reasoning-planning-decision", "api-tool-integration", "automation-long-running", "ai-model-specific"],
    "api-tool-integration": ["agent-orchestration", "code-software-engineering", "infrastructure-reliability"],
    "automation-long-running": ["agent-orchestration", "memory-kb-rag", "infrastructure-reliability"],
    "infrastructure-reliability": ["code-software-engineering", "api-tool-integration", "security-risk"],
    "security-risk": ["code-software-engineering", "testing-debug-quality", "infrastructure-reliability"],
    "ai-model-specific": ["agent-orchestration", "compression-context", "code-software-engineering"],
    "ui-ux-design": ["document-content", "business-domain-operations"],
    "business-domain-operations": ["reasoning-planning-decision", "document-content", "data-processing-analytics", "ui-ux-design"],
}


def unique(values: Iterable[str], limit: int | None = None) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = str(value or "").strip()
        key = item.casefold()
        if not item or key in seen:
            continue
        seen.add(key)
        result.append(item)
        if limit is not None and len(result) >= limit:
            break
    return result


def load_taxonomy(path: Path | None = None) -> dict[str, Any]:
    target = path or Path(__file__).resolve().parents[2] / "skill-taxonomy.json"
    if target.is_file():
        try:
            data = json.loads(target.read_text("utf-8"))
            if {str(item["id"]) for item in data.get("domains", [])}.issuperset(DOMAIN_IDS):
                return data
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            pass
    return {
        "schemaVersion": 1,
        "domains": [{"id": item} for item in DOMAIN_IDS],
        "categoryDomainMap": CATEGORY_DOMAIN_MAP,
        "domainCompatibility": DOMAIN_COMPATIBILITY,
    }


def domains_for(categories: Iterable[str], taxonomy: dict[str, Any]) -> list[str]:
    mapping = taxonomy.get("categoryDomainMap") or CATEGORY_DOMAIN_MAP
    values: list[str] = []
    for category in categories:
        mapped = mapping.get(category, [])
        values.extend([mapped] if isinstance(mapped, str) else mapped)
        if not mapped and category in DOMAIN_IDS:
            values.append(category)
    return unique(values or ["understanding-analysis"], 18)
