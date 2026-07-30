from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from .http import HttpClient, HttpError


@dataclass(slots=True)
class NotionLedgerClient:
    http: HttpClient
    token: str
    data_source_id: str
    notion_version: str = "2026-03-11"

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": self.notion_version,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def upsert(self, flat_properties: dict[str, Any]) -> dict[str, Any]:
        if flat_properties.get("Admission Passed") is not True or flat_properties.get("Status") != "完了":
            return {"status": "skipped", "reason": "only completed Astera-admitted assets are synchronized"}
        if flat_properties.get("Selectable") is not True:
            return {"status": "skipped", "reason": "only selection-ready assets are synchronized"}
        content_hash = str(flat_properties.get("Content Hash") or "")
        if not content_hash:
            raise ValueError("Content Hash is required for Notion upsert")
        existing = self._query_by_hash(content_hash)
        properties = self._encode_properties(flat_properties)
        if existing:
            page_id = str(existing[0]["id"])
            response = self._json_request("PATCH", f"https://api.notion.com/v1/pages/{page_id}", {"properties": properties})
            return {"status": "updated", "page_id": page_id, "url": response.get("url")}
        response = self._json_request(
            "POST",
            "https://api.notion.com/v1/pages",
            {"parent": {"type": "data_source_id", "data_source_id": self.data_source_id}, "properties": properties},
        )
        return {"status": "created", "page_id": response.get("id"), "url": response.get("url")}

    def _query_by_hash(self, content_hash: str) -> list[dict[str, Any]]:
        response = self._json_request(
            "POST",
            f"https://api.notion.com/v1/data_sources/{self.data_source_id}/query",
            {"page_size": 2, "filter": {"property": "Content Hash", "rich_text": {"equals": content_hash}}},
        )
        return list(response.get("results") or [])

    def _json_request(self, method: str, url: str, data: dict[str, Any]) -> dict[str, Any]:
        status, _, payload = self.http.request(
            url,
            method=method,
            headers=self.headers,
            body=json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        )
        try:
            result = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise HttpError(f"Notion returned invalid JSON: HTTP {status}", status=status, body=payload[:4096]) from error
        if not isinstance(result, dict):
            raise HttpError("Notion returned an invalid response object", status=status, body=payload[:4096])
        return result

    @staticmethod
    def _text(value: Any) -> list[dict[str, Any]]:
        text = str(value or "")[:2000]
        return [{"type": "text", "text": {"content": text}}] if text else []

    def _encode_properties(self, values: dict[str, Any]) -> dict[str, Any]:
        multi_fields = {"Language", "Tags", "Capability Domains", "Compatible Domains", "Execution Methods"}
        select_fields = {"Artifact Type", "Risk Level", "Speed Profile", "Cost Profile", "Selection Readiness"}
        rich_text_fields = {
            "Repository",
            "Module Path",
            "Entry Point",
            "Capabilities",
            "Source Version",
            "License",
            "Content Hash",
            "GitHub Commit",
            "Notes",
            "Problem Solved",
            "Input Contract",
            "Output Contract",
            "Strength Conditions",
            "Constraint Conditions",
            "Dependencies",
            "Compatible Skills",
            "Selection Keywords",
        }
        result: dict[str, Any] = {"Name": {"title": self._text(values.get("Name"))}}
        for field in multi_fields:
            items = values.get(field) or []
            if isinstance(items, str):
                items = [item.strip() for item in items.split(",") if item.strip()]
            result[field] = {"multi_select": [{"name": str(item)[:100]} for item in list(items)[:100]]}
        for field in select_fields:
            value = values.get(field)
            result[field] = {"select": {"name": str(value)[:100]} if value else None}
        for field in rich_text_fields:
            result[field] = {"rich_text": self._text(values.get(field))}
        result["Status"] = {"status": {"name": str(values.get("Status"))[:100]}}
        result["Source URL"] = {"url": str(values.get("Source URL") or "") or None}
        for field in ("Quality Score", "Completion Score", "Evidence Count", "Base Fitness Score"):
            value = values.get(field)
            result[field] = {"number": float(value) if value is not None else None}
        result["Admission Passed"] = {"checkbox": bool(values.get("Admission Passed"))}
        result["Selectable"] = {"checkbox": bool(values.get("Selectable"))}
        result["Last Validated"] = {"date": {"start": str(values.get("Last Validated"))} if values.get("Last Validated") else None}
        return result


def sync_completed_records(client: NotionLedgerClient, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for record in records:
        try:
            results.append({"content_hash": record.get("Content Hash"), **client.upsert(record)})
        except Exception as error:
            results.append({"content_hash": record.get("Content Hash"), "status": "failed", "error": str(error)})
    return results
