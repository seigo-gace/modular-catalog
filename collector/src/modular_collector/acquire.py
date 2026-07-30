from __future__ import annotations

import io
import os
import shutil
import tarfile
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from .http import HttpClient
from .models import Candidate


class AcquisitionError(RuntimeError):
    pass


@dataclass(slots=True)
class SourceAcquirer:
    http: HttpClient
    max_files: int = 20_000
    max_unpacked_bytes: int = 250 * 1024 * 1024

    def acquire(self, candidate: Candidate, destination: Path, *, headers: Mapping[str, str] | None = None) -> Path:
        if not candidate.source_url:
            raise AcquisitionError(f"candidate has no source archive: {candidate.stable_id}")
        destination.mkdir(parents=True, exist_ok=True)
        _, response_headers, payload = self.http.request(candidate.source_url, headers=headers)
        content_type = str(response_headers.get("Content-Type", "")).lower()
        with tempfile.TemporaryDirectory(prefix="modular-source-") as temp_dir:
            temp_root = Path(temp_dir)
            if payload[:2] == b"PK" or "zip" in content_type:
                self._extract_zip(payload, temp_root)
            elif self._is_tar(payload):
                self._extract_tar(payload, temp_root)
            else:
                raise AcquisitionError("unsupported archive format")
            source_root = self._single_root(temp_root)
            self._copy_safe(source_root, destination)
        return destination

    @staticmethod
    def _is_tar(payload: bytes) -> bool:
        try:
            with tarfile.open(fileobj=io.BytesIO(payload), mode="r:*"):
                return True
        except tarfile.TarError:
            return False

    def _single_root(self, root: Path) -> Path:
        entries = [entry for entry in root.iterdir() if entry.name not in {"__MACOSX"}]
        if len(entries) == 1 and entries[0].is_dir():
            return entries[0]
        return root

    def _extract_zip(self, payload: bytes, destination: Path) -> None:
        total = 0
        count = 0
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            for info in archive.infolist():
                count += 1
                total += int(info.file_size)
                if count > self.max_files or total > self.max_unpacked_bytes:
                    raise AcquisitionError("archive exceeds extraction limits")
                target = self._safe_target(destination, info.filename)
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as source, target.open("wb") as sink:
                    shutil.copyfileobj(source, sink)

    def _extract_tar(self, payload: bytes, destination: Path) -> None:
        total = 0
        count = 0
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:*") as archive:
            for member in archive.getmembers():
                if member.issym() or member.islnk() or member.isdev():
                    raise AcquisitionError(f"unsafe archive member: {member.name}")
                count += 1
                total += max(0, int(member.size))
                if count > self.max_files or total > self.max_unpacked_bytes:
                    raise AcquisitionError("archive exceeds extraction limits")
                target = self._safe_target(destination, member.name)
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                if not member.isfile():
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                if source is None:
                    continue
                with source, target.open("wb") as sink:
                    shutil.copyfileobj(source, sink)

    @staticmethod
    def _safe_target(root: Path, member_name: str) -> Path:
        normalized = member_name.replace("\\", "/")
        if normalized.startswith("/") or normalized.startswith("../") or "/../" in f"/{normalized}/":
            raise AcquisitionError(f"path traversal rejected: {member_name}")
        target = (root / normalized).resolve()
        root_resolved = root.resolve()
        if target != root_resolved and root_resolved not in target.parents:
            raise AcquisitionError(f"path traversal rejected: {member_name}")
        return target

    def _copy_safe(self, source: Path, destination: Path) -> None:
        count = 0
        total = 0
        for item in source.rglob("*"):
            if item.is_symlink():
                raise AcquisitionError(f"symbolic link rejected: {item}")
            relative = item.relative_to(source)
            target = destination / relative
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if not item.is_file():
                continue
            count += 1
            size = item.stat().st_size
            total += size
            if count > self.max_files or total > self.max_unpacked_bytes:
                raise AcquisitionError("source exceeds configured limits")
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def remove_source_tree(path: Path) -> None:
    if path.exists():
        for root, dirs, files in os.walk(path, topdown=False):
            for name in files:
                Path(root, name).unlink(missing_ok=True)
            for name in dirs:
                Path(root, name).rmdir()
        path.rmdir()
