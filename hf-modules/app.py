from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover - deterministic fallback remains available
    genai = None
    types = None


MODULES: dict[str, dict[str, Any]] = {
    "task-aggregate": {
        "name": "Task Decomposition and Aggregation Module",
        "scope": [
            "intent", "purpose", "requirements", "constraints", "task_graph",
            "capability_requests", "result_aggregation",
        ],
        "forbidden": ["final_decision", "quality_approval", "authority_escalation"],
    },
    "research-evidence": {
        "name": "Research and Evidence WORK Module",
        "scope": [
            "search_plan", "source_collection", "source_reliability", "claim_evidence_mapping",
            "citation", "evidence_gap_detection",
        ],
        "forbidden": ["code_deployment", "final_decision", "unsupported_claim"],
    },
    "architecture-code": {
        "name": "Architecture and Code WORK Module",
        "scope": [
            "repository_understanding", "logic_extraction", "modular_decomposition", "architecture",
            "code_generation", "testing", "debugging", "reconstruction",
        ],
        "forbidden": ["production_deploy", "secret_exposure", "final_decision"],
    },
    "language-review": {
        "name": "Language, Document and Review WORK Module",
        "scope": [
            "japanese_processing", "document_generation", "fixed_format", "summarization",
            "compression", "requirement_coverage", "factuality", "consistency_review",
        ],
        "forbidden": ["source_invention", "evidence_fabrication", "final_decision"],
    },
}


class ModuleRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task: str = Field(min_length=1, max_length=200_000)
    context: dict[str, Any] = Field(default_factory=dict)
    required_capabilities: list[str] = Field(default_factory=list)
    authority: list[str] = Field(default_factory=list)
    max_output_tokens: int = Field(default=2048, ge=128, le=8192)
    use_gemini: bool = True


class ModuleResponse(BaseModel):
    request_id: str
    module_id: str
    status: str
    result: dict[str, Any]
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    unresolved: list[str] = Field(default_factory=list)
    provider: str
    model: str | None = None
    quota_state: dict[str, Any]
    complete: bool = False


@dataclass(frozen=True)
class QuotaPolicy:
    rpm: int
    tpm: int
    rpd: int
    safety_margin: float = 0.85

    @classmethod
    def from_env(cls) -> "QuotaPolicy":
        return cls(
            rpm=max(1, int(os.getenv("GEMINI_MODULE_RPM", "3"))),
            tpm=max(256, int(os.getenv("GEMINI_MODULE_TPM", "12000"))),
            rpd=max(1, int(os.getenv("GEMINI_MODULE_RPD", "100"))),
            safety_margin=min(0.95, max(0.50, float(os.getenv("GEMINI_QUOTA_SAFETY_MARGIN", "0.85")))),
        )


class QuotaGuard:
    """Per-module free-tier guard. Split project limits across four modules."""

    def __init__(self, path: Path, policy: QuotaPolicy):
        self.path = path
        self.policy = policy
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _minute_key(now: datetime) -> str:
        return now.strftime("%Y-%m-%dT%H:%M")

    @staticmethod
    def _day_key(now: datetime) -> str:
        return now.strftime("%Y-%m-%d")

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"minute": {}, "day": {}, "blocked_until": 0.0}
        try:
            return json.loads(self.path.read_text("utf-8"))
        except Exception:
            return {"minute": {}, "day": {}, "blocked_until": 0.0}

    def _save(self, state: dict[str, Any]) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.path)

    @staticmethod
    def estimate_tokens(text: str) -> int:
        return max(1, (len(text.encode("utf-8")) + 2) // 3)

    def reserve(self, estimated_input: int, max_output: int) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        with self._lock:
            state = self._load()
            if float(state.get("blocked_until", 0.0)) > time.time():
                raise RuntimeError("gemini_temporarily_blocked")

            minute_key = self._minute_key(now)
            day_key = self._day_key(now)
            minute = state.setdefault("minute", {}).setdefault(minute_key, {"requests": 0, "tokens": 0})
            day = state.setdefault("day", {}).setdefault(day_key, {"requests": 0})
            total_tokens = estimated_input + max_output
            rpm_limit = max(1, int(self.policy.rpm * self.policy.safety_margin))
            tpm_limit = max(1, int(self.policy.tpm * self.policy.safety_margin))
            rpd_limit = max(1, int(self.policy.rpd * self.policy.safety_margin))

            if minute["requests"] + 1 > rpm_limit:
                raise RuntimeError("gemini_rpm_budget_exhausted")
            if minute["tokens"] + total_tokens > tpm_limit:
                raise RuntimeError("gemini_tpm_budget_exhausted")
            if day["requests"] + 1 > rpd_limit:
                raise RuntimeError("gemini_rpd_budget_exhausted")

            minute["requests"] += 1
            minute["tokens"] += total_tokens
            day["requests"] += 1
            state["minute"] = {minute_key: minute}
            state["day"] = {day_key: day}
            self._save(state)
            return self.snapshot(state)

    def provider_429(self, retry_after_seconds: int = 60) -> None:
        with self._lock:
            state = self._load()
            state["blocked_until"] = time.time() + max(30, min(retry_after_seconds, 3600))
            self._save(state)

    def snapshot(self, state: dict[str, Any] | None = None) -> dict[str, Any]:
        state = state or self._load()
        return {
            "policy": {
                "rpm": self.policy.rpm,
                "tpm": self.policy.tpm,
                "rpd": self.policy.rpd,
                "safety_margin": self.policy.safety_margin,
            },
            "minute": state.get("minute", {}),
            "day": state.get("day", {}),
            "blocked_until": state.get("blocked_until", 0.0),
        }


class GeminiFreeProvider:
    def __init__(self, guard: QuotaGuard):
        self.guard = guard
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.lite_model = os.getenv("GEMINI_LITE_MODEL", "gemini-2.5-flash-lite")
        self.flash_model = os.getenv("GEMINI_FLASH_MODEL", "gemini-2.5-flash")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and genai is not None)

    def generate(self, *, system: str, prompt: str, max_output_tokens: int, hard: bool) -> tuple[str, str, dict[str, Any]]:
        if not self.enabled:
            raise RuntimeError("gemini_not_configured")
        model = self.flash_model if hard else self.lite_model
        quota = self.guard.reserve(self.guard.estimate_tokens(system + prompt), max_output_tokens)
        try:
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=max_output_tokens,
                    response_mime_type="application/json",
                ),
            )
            text = response.text or "{}"
            return text, model, quota
        except Exception as error:
            message = str(error)
            if "429" in message or "RESOURCE_EXHAUSTED" in message or "quota" in message.lower():
                self.guard.provider_429()
                raise RuntimeError("gemini_quota_exhausted") from error
            raise


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    except Exception:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, dict) else {"value": parsed}
            except Exception:
                pass
    return {"text": text}


def deterministic_result(module_id: str, request: ModuleRequest) -> dict[str, Any]:
    text = request.task.strip()
    sentences = [item.strip() for item in re.split(r"[\n。！？!?]+", text) if item.strip()]
    if module_id == "task-aggregate":
        tasks = [
            {"task_id": f"T{index:03d}", "instruction": sentence, "depends_on": [] if index == 1 else [f"T{index-1:03d}"]}
            for index, sentence in enumerate(sentences[:30], start=1)
        ]
        return {
            "purpose": sentences[0] if sentences else text,
            "requirements": sentences,
            "constraints": request.context.get("constraints", []),
            "task_graph": tasks,
            "capability_requests": request.required_capabilities,
            "aggregated_material": request.context.get("worker_results", []),
        }
    if module_id == "research-evidence":
        return {
            "search_queries": sentences[:20] or [text],
            "claims": [],
            "evidence": [],
            "gaps": ["external_search_not_executed"],
        }
    if module_id == "architecture-code":
        return {
            "logic_units": sentences[:30],
            "layers": ["Part", "Feature", "Component", "System", "Application System"],
            "tests_required": ["unit", "integration", "failure", "resume"],
            "unresolved": ["repository_source_required"],
        }
    return {
        "document_plan": sentences[:30],
        "review": {
            "requirement_coverage": 0,
            "factuality": "not_evaluated_without_evidence",
            "consistency_issues": [],
        },
        "unresolved": ["evidence_required_for_completion"],
    }


def system_prompt(module_id: str) -> str:
    contract = MODULES[module_id]
    return (
        "You are an external capability module. You are not AMATERAS and must not make the final decision. "
        f"Module: {contract['name']}. Allowed scope: {', '.join(contract['scope'])}. "
        f"Forbidden: {', '.join(contract['forbidden'])}. "
        "Return JSON only. Preserve evidence and unresolved items. Never invent sources."
    )


def user_prompt(module_id: str, request: ModuleRequest) -> str:
    return json.dumps(
        {
            "module_id": module_id,
            "task": request.task,
            "context": request.context,
            "required_capabilities": request.required_capabilities,
            "authority": request.authority,
            "required_output": {
                "result": "module-specific structured result",
                "evidence": [],
                "unresolved": [],
                "complete": False,
            },
        },
        ensure_ascii=False,
    )


MODULE_ID = os.getenv("MODULE_ID", "task-aggregate").strip()
if MODULE_ID not in MODULES:
    raise RuntimeError(f"unknown MODULE_ID: {MODULE_ID}")

quota_guard = QuotaGuard(Path(os.getenv("QUOTA_STATE_PATH", "/tmp/module-state/gemini-quota.json")), QuotaPolicy.from_env())
provider = GeminiFreeProvider(quota_guard)
app = FastAPI(title=MODULES[MODULE_ID]["name"], version="1.0.0")


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "ok": True,
        "module_id": MODULE_ID,
        "module_name": MODULES[MODULE_ID]["name"],
        "gemini_enabled": provider.enabled,
        "quota": quota_guard.snapshot(),
        "amateras_embedded": False,
    }


@app.get("/v1/module/contract")
def contract() -> dict[str, Any]:
    return {"module_id": MODULE_ID, **MODULES[MODULE_ID], "amateras_embedded": False}


@app.post("/v1/module/process", response_model=ModuleResponse)
def process(request: ModuleRequest) -> ModuleResponse:
    fallback = deterministic_result(MODULE_ID, request)
    if not request.use_gemini:
        return ModuleResponse(
            request_id=request.request_id,
            module_id=MODULE_ID,
            status="partial",
            result=fallback,
            unresolved=["gemini_disabled_by_request", "astera_quality_gate_not_executed"],
            provider="deterministic",
            quota_state=quota_guard.snapshot(),
            complete=False,
        )

    hard = MODULE_ID in {"task-aggregate", "architecture-code"} or len(request.task) > 8000
    try:
        raw, model, quota = provider.generate(
            system=system_prompt(MODULE_ID),
            prompt=user_prompt(MODULE_ID, request),
            max_output_tokens=request.max_output_tokens,
            hard=hard,
        )
        parsed = _extract_json(raw)
        return ModuleResponse(
            request_id=request.request_id,
            module_id=MODULE_ID,
            status="partial",
            result=parsed.get("result", parsed),
            evidence=parsed.get("evidence", []),
            unresolved=[*parsed.get("unresolved", []), "astera_quality_gate_not_executed"],
            provider="gemini-free-guarded",
            model=model,
            quota_state=quota,
            complete=False,
        )
    except RuntimeError as error:
        return ModuleResponse(
            request_id=request.request_id,
            module_id=MODULE_ID,
            status="checkpointed",
            result=fallback,
            unresolved=[str(error), "resume_after_quota_or_configuration", "astera_quality_gate_not_executed"],
            provider="deterministic-fallback",
            quota_state=quota_guard.snapshot(),
            complete=False,
        )
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"module_provider_failure: {error}") from error
