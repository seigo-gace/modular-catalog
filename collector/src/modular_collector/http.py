from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping


class HttpError(RuntimeError):
    def __init__(self, message: str, *, status: int | None = None, body: bytes = b"") -> None:
        super().__init__(message)
        self.status = status
        self.body = body


@dataclass(slots=True)
class HttpClient:
    timeout_seconds: float = 30.0
    max_response_bytes: int = 50 * 1024 * 1024
    retries: int = 2
    user_agent: str = "modular-catalog-collector/1.0"

    def request(
        self,
        url: str,
        *,
        method: str = "GET",
        headers: Mapping[str, str] | None = None,
        body: bytes | None = None,
    ) -> tuple[int, Mapping[str, str], bytes]:
        merged = {"User-Agent": self.user_agent, "Accept": "application/json"}
        if headers:
            merged.update(headers)
        request = urllib.request.Request(url, data=body, headers=merged, method=method)
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                    declared = response.headers.get("Content-Length")
                    if declared and int(declared) > self.max_response_bytes:
                        raise HttpError("response exceeds configured size limit", status=response.status)
                    payload = response.read(self.max_response_bytes + 1)
                    if len(payload) > self.max_response_bytes:
                        raise HttpError("response exceeds configured size limit", status=response.status)
                    return response.status, dict(response.headers.items()), payload
            except urllib.error.HTTPError as error:
                payload = error.read(min(self.max_response_bytes, 64 * 1024))
                if error.code not in {429, 500, 502, 503, 504} or attempt >= self.retries:
                    raise HttpError(f"HTTP {error.code} for {url}", status=error.code, body=payload) from error
                last_error = error
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt >= self.retries:
                    raise HttpError(f"request failed for {url}: {error}") from error
                last_error = error
            time.sleep(min(2**attempt, 4))
        raise HttpError(f"request failed for {url}: {last_error}")

    def get_json(self, url: str, *, headers: Mapping[str, str] | None = None) -> Any:
        _, _, payload = self.request(url, headers=headers)
        try:
            return json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise HttpError(f"invalid JSON from {url}", body=payload[:4096]) from error

    def post_json(self, url: str, data: Any, *, headers: Mapping[str, str] | None = None) -> Any:
        merged = {"Content-Type": "application/json"}
        if headers:
            merged.update(headers)
        _, _, payload = self.request(
            url,
            method="POST",
            headers=merged,
            body=json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        )
        try:
            return json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return payload.decode("utf-8", "replace")
