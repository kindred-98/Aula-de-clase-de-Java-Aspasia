"""Metadatos de GitHub con caché en memoria y degradación segura."""

from __future__ import annotations

import re
import time
from typing import Any

import httpx

_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, dict[str, Any]]] = {}

_REPO_RE = re.compile(
    r"^https://github\.com/"
    r"(?P<owner>[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)/"
    r"(?P<repo>[A-Za-z0-9._-]+)/?$"
)


def parse_github_url(url: str) -> tuple[str, str] | None:
    m = _REPO_RE.match(url.strip())
    if not m:
        return None
    owner = m.group("owner")
    repo = m.group("repo")
    if repo.endswith(".git"):
        repo = repo[: -len(".git")]
    return owner, repo


def fetch_repo_metadata(url: str) -> dict[str, Any]:
    """Devuelve metadatos públicos; nunca lanza por fallo de red/API."""
    parsed = parse_github_url(url)
    base: dict[str, Any] = {
        "url": url,
        "full_name": None,
        "description": None,
        "language": None,
        "default_branch": None,
        "stars": None,
        "pushed_at": None,
        "html_url": None,
        "cached": False,
        "ok": False,
        "error": None,
    }
    if parsed is None:
        base["error"] = "invalid_url"
        return base

    owner, repo = parsed
    cache_key = f"{owner}/{repo}".lower()
    now = time.monotonic()
    hit = _cache.get(cache_key)
    if hit is not None and now - hit[0] < _CACHE_TTL_SECONDS:
        data = dict(hit[1])
        data["cached"] = True
        data["ok"] = True
        data["error"] = None
        return data

    api_url = f"https://api.github.com/repos/{owner}/{repo}"
    try:
        with httpx.Client(timeout=3.0, follow_redirects=True) as client:
            resp = client.get(
                api_url,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "aula-virtual-backend",
                },
            )
        if resp.status_code == 404:
            base["error"] = "not_found"
            return base
        if resp.status_code == 403:
            base["error"] = "rate_limited"
            return base
        if resp.status_code >= 400:
            base["error"] = f"http_{resp.status_code}"
            return base
        payload = resp.json()
    except (httpx.HTTPError, ValueError, TypeError):
        base["error"] = "network_error"
        return base

    data = {
        "url": url,
        "full_name": payload.get("full_name"),
        "description": payload.get("description"),
        "language": payload.get("language"),
        "default_branch": payload.get("default_branch"),
        "stars": payload.get("stargazers_count"),
        "pushed_at": payload.get("pushed_at"),
        "html_url": payload.get("html_url"),
        "cached": False,
        "ok": True,
        "error": None,
    }
    _cache[cache_key] = (now, data)
    return data


def clear_cache() -> None:
    _cache.clear()
