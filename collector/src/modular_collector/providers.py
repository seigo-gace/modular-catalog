from __future__ import annotations

import html.parser
import os
import urllib.parse
from dataclasses import dataclass
from typing import Protocol

from .http import HttpClient
from .models import Candidate, SearchQuery


class Provider(Protocol):
    name: str

    def search(self, query: SearchQuery) -> list[Candidate]: ...


@dataclass(slots=True)
class GitHubProvider:
    http: HttpClient
    token: str | None = None
    name: str = "github"

    def search(self, query: SearchQuery) -> list[Candidate]:
        qualifiers = [query.keyword, f"stars:>={query.minimum_stars}"]
        if not query.include_archived:
            qualifiers.append("archived:false")
        if len(query.languages) == 1:
            qualifiers.append(f"language:{query.languages[0]}")
        params = urllib.parse.urlencode({
            "q": " ".join(qualifiers),
            "sort": "stars",
            "order": "desc",
            "per_page": query.limit_per_provider,
        })
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        data = self.http.get_json(f"https://api.github.com/search/repositories?{params}", headers=headers)
        items = data.get("items", []) if isinstance(data, dict) else []
        candidates: list[Candidate] = []
        for item in items:
            license_info = item.get("license") or {}
            candidates.append(Candidate(
                provider=self.name,
                external_id=str(item.get("full_name") or item.get("id")),
                name=str(item.get("full_name") or item.get("name") or "unknown"),
                description=str(item.get("description") or ""),
                web_url=str(item.get("html_url") or ""),
                source_url=str(item.get("archive_url") or "").replace("{/ref}", f"/{item.get('default_branch') or 'HEAD'}").replace("{archive_format}", "zipball"),
                repository_url=str(item.get("clone_url") or item.get("html_url") or ""),
                default_branch=item.get("default_branch"),
                source_ref=item.get("default_branch"),
                license_spdx=license_info.get("spdx_id"),
                primary_language=item.get("language"),
                languages=[item["language"]] if item.get("language") else [],
                topics=list(item.get("topics") or []),
                stars=int(item.get("stargazers_count") or 0),
                updated_at=item.get("updated_at"),
                archived=bool(item.get("archived")),
                matched_keywords=[query.keyword],
                raw=item,
            ))
        return candidates


@dataclass(slots=True)
class GitLabProvider:
    http: HttpClient
    token: str | None = None
    base_url: str = "https://gitlab.com"
    name: str = "gitlab"

    def search(self, query: SearchQuery) -> list[Candidate]:
        params = urllib.parse.urlencode({
            "search": query.keyword,
            "simple": "true",
            "order_by": "star_count",
            "sort": "desc",
            "per_page": query.limit_per_provider,
        })
        headers = {"PRIVATE-TOKEN": self.token} if self.token else None
        data = self.http.get_json(f"{self.base_url.rstrip('/')}/api/v4/projects?{params}", headers=headers)
        candidates: list[Candidate] = []
        for item in data if isinstance(data, list) else []:
            if item.get("archived") and not query.include_archived:
                continue
            project_id = item.get("id")
            branch = item.get("default_branch") or "HEAD"
            candidates.append(Candidate(
                provider=self.name,
                external_id=str(item.get("path_with_namespace") or project_id),
                name=str(item.get("path_with_namespace") or item.get("name") or project_id),
                description=str(item.get("description") or ""),
                web_url=str(item.get("web_url") or ""),
                source_url=f"{self.base_url.rstrip('/')}/api/v4/projects/{project_id}/repository/archive.zip?sha={urllib.parse.quote(branch)}",
                repository_url=str(item.get("http_url_to_repo") or item.get("web_url") or ""),
                default_branch=branch,
                source_ref=branch,
                topics=list(item.get("topics") or item.get("tag_list") or []),
                stars=int(item.get("star_count") or 0),
                updated_at=item.get("last_activity_at"),
                archived=bool(item.get("archived")),
                matched_keywords=[query.keyword],
                raw=item,
            ))
        return candidates


@dataclass(slots=True)
class NpmProvider:
    http: HttpClient
    name: str = "npm"

    def search(self, query: SearchQuery) -> list[Candidate]:
        params = urllib.parse.urlencode({"text": query.keyword, "size": query.limit_per_provider})
        data = self.http.get_json(f"https://registry.npmjs.org/-/v1/search?{params}")
        candidates: list[Candidate] = []
        for result in data.get("objects", []) if isinstance(data, dict) else []:
            package = result.get("package") or {}
            links = package.get("links") or {}
            name = str(package.get("name") or "")
            version = str(package.get("version") or "")
            detail: dict = {}
            if name and version:
                try:
                    detail = self.http.get_json(
                        f"https://registry.npmjs.org/{urllib.parse.quote(name, safe='@')}/{urllib.parse.quote(version)}"
                    )
                except Exception:
                    detail = {}
            dist = detail.get("dist") or {}
            repository = detail.get("repository") or {}
            repository_url = repository.get("url") if isinstance(repository, dict) else repository
            candidates.append(Candidate(
                provider=self.name,
                external_id=name,
                name=name,
                description=str(package.get("description") or detail.get("description") or ""),
                web_url=str(links.get("npm") or links.get("homepage") or ""),
                source_url=dist.get("tarball"),
                repository_url=str(repository_url or links.get("repository") or "") or None,
                version=version or None,
                license_spdx=detail.get("license") if isinstance(detail.get("license"), str) else None,
                primary_language="JavaScript",
                languages=["JavaScript"],
                topics=list(package.get("keywords") or detail.get("keywords") or []),
                updated_at=package.get("date"),
                matched_keywords=[query.keyword],
                raw={"search": result, "package": detail},
            ))
        return candidates


@dataclass(slots=True)
class CratesProvider:
    http: HttpClient
    name: str = "crates"

    def search(self, query: SearchQuery) -> list[Candidate]:
        params = urllib.parse.urlencode({"q": query.keyword, "per_page": query.limit_per_provider})
        data = self.http.get_json(f"https://crates.io/api/v1/crates?{params}")
        candidates: list[Candidate] = []
        for item in data.get("crates", []) if isinstance(data, dict) else []:
            crate_id = str(item.get("id"))
            version = item.get("max_stable_version") or item.get("newest_version") or item.get("max_version")
            source_url = f"https://crates.io/api/v1/crates/{urllib.parse.quote(crate_id)}/{urllib.parse.quote(str(version))}/download" if version else None
            candidates.append(Candidate(
                provider=self.name,
                external_id=crate_id,
                name=crate_id,
                description=str(item.get("description") or ""),
                web_url=f"https://crates.io/crates/{urllib.parse.quote(crate_id)}",
                source_url=source_url,
                repository_url=item.get("repository"),
                version=version,
                primary_language="Rust",
                languages=["Rust"],
                downloads=int(item.get("downloads") or 0),
                updated_at=item.get("updated_at"),
                matched_keywords=[query.keyword],
                raw=item,
            ))
        return candidates


class _PyPiSearchParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.projects: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href") or ""
        if href.startswith("/project/"):
            parts = href.strip("/").split("/")
            if len(parts) >= 2 and parts[1] not in self.projects:
                self.projects.append(parts[1])


@dataclass(slots=True)
class PyPiProvider:
    http: HttpClient
    name: str = "pypi"

    def search(self, query: SearchQuery) -> list[Candidate]:
        params = urllib.parse.urlencode({"q": query.keyword})
        _, _, payload = self.http.request(
            f"https://pypi.org/search/?{params}",
            headers={"Accept": "text/html,application/xhtml+xml"},
        )
        parser = _PyPiSearchParser()
        parser.feed(payload.decode("utf-8", "replace"))
        candidates: list[Candidate] = []
        for project in parser.projects[: query.limit_per_provider]:
            try:
                data = self.http.get_json(f"https://pypi.org/pypi/{urllib.parse.quote(project)}/json")
            except Exception:
                continue
            info = data.get("info") or {}
            urls = data.get("urls") or []
            sdist = next((item for item in urls if item.get("packagetype") == "sdist"), None)
            project_urls = info.get("project_urls") or {}
            repository = project_urls.get("Source") or project_urls.get("Repository") or project_urls.get("Code")
            candidates.append(Candidate(
                provider=self.name,
                external_id=str(info.get("name") or project),
                name=str(info.get("name") or project),
                description=str(info.get("summary") or ""),
                web_url=str(info.get("package_url") or f"https://pypi.org/project/{project}/"),
                source_url=(sdist or {}).get("url"),
                repository_url=repository,
                version=info.get("version"),
                license_spdx=info.get("license_expression") or info.get("license"),
                primary_language="Python",
                languages=["Python"],
                topics=list(info.get("keywords") or []) if isinstance(info.get("keywords"), list) else str(info.get("keywords") or "").split(),
                matched_keywords=[query.keyword],
                raw=data,
            ))
        return candidates


def default_providers(http: HttpClient) -> dict[str, Provider]:
    return {
        "github": GitHubProvider(http, token=os.getenv("GITHUB_TOKEN")),
        "gitlab": GitLabProvider(http, token=os.getenv("GITLAB_TOKEN")),
        "npm": NpmProvider(http),
        "pypi": PyPiProvider(http),
        "crates": CratesProvider(http),
    }
