"""Curated 'Daily Good News' uplifting digest powered by Exa neural search + Gemini filter.

Conforms strictly to ActivityConfig.instructions (list[str], each 1..500 chars, max 20 items)
so no custom schema fields are needed and every response passes OpenAPI 2.0.0 validation.
"""

from __future__ import annotations

import os
import re
import time
from typing import Any

import httpx

GOOD_NEWS_ACTIVITY_ID = "22222222-2222-4222-8222-222222222225"

FALLBACK_STORIES: list[str] = [
    "[Espoo · Nature] Nuuksio lakeland volunteers and park rangers completed new accessible forest boardwalks and bird nesting boxes, welcoming a record return of whooper swans.",
    "[Otaniemi · Science] Aalto University researchers unveiled gentle indoor-light solar textiles capable of powering everyday wellbeing wearables without battery swaps.",
    "[Helsinki · Community] Neighborhood library music and craft rooms across the capital region celebrated a record month of free evening gatherings and shared community meals.",
    "[Archipelago · Ecology] Marine restoration teams planted 12,000 new Baltic eelgrass shoots this season, creating calm nursery habitats for coastal sea life.",
]

NEGATIVE_TERMS = re.compile(
    r"\b(war|killed|dead|death|crash|crisis|murder|attack|terror|inflation|recession|layoff|scandal|disaster|tragedy|shooting|conflict|strike|protest|lawsuit)\b",
    re.IGNORECASE,
)

_CACHE: dict[str, Any] = {"stories": None, "fetched_at": 0.0, "key_fingerprint": ""}
CACHE_TTL_SECONDS = 1800.0


def _is_strictly_uplifting(text: str) -> bool:
    return bool(text and text.strip()) and not bool(NEGATIVE_TERMS.search(text))


def _clean_story(text: str, max_len: int = 420) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= max_len:
        return compact
    if " " not in compact[: max_len - 1]:
        return f"{compact[: max_len - 1]}…"
    clipped = compact[: max_len - 1].rsplit(" ", 1)[0].rstrip(".,;:")
    return f"{clipped}…"


async def _fetch_exa_candidates(exa_api_key: str) -> list[dict[str, str]]:
    async with httpx.AsyncClient(timeout=6.0) as client:
        response = await client.post(
            "https://api.exa.ai/search",
            headers={
                "x-api-key": exa_api_key,
                "Content-Type": "application/json",
            },
            json={
                "query": "uplifting positive community nature restoration science kindness news in Finland Nordics Europe",
                "type": "auto",
                "numResults": 6,
                "contents": {"text": {"maxCharacters": 360}},
            },
        )
        response.raise_for_status()
        payload = response.json()
    results = payload.get("results") or []
    candidates: list[dict[str, str]] = []
    for item in results:
        title = str(item.get("title") or "").strip()
        snippet = str(item.get("text") or "").strip()
        combined = f"{title} {snippet}"
        if not title or NEGATIVE_TERMS.search(combined):
            continue
        candidates.append({"title": title, "snippet": snippet})
    return candidates


async def _summarize_with_gemini(
    gemini_api_key: str, candidates: list[dict[str, str]]
) -> list[str]:
    if not candidates:
        return []
    raw_block = "\n".join(
        f"- Title: {c['title']} | Snippet: {c['snippet'][:240]}" for c in candidates[:5]
    )
    prompt = (
        "You are curating a 'Daily Good News' restorative digest for a patient recovering at home. "
        "Select up to 4 genuinely uplifting, calm, hopeful stories from the candidates below. "
        "Exclude anything stressful, political, or tragic. "
        "Format each story on a single line starting with a short bracketed tag like [Nature] or [Community], "
        "followed by 1-2 warm, factual sentences (between 60 and 320 characters per line). "
        "Output ONLY the lines, one per story, with no bullets or numbering.\n\n"
        f"{raw_block}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"
    async with httpx.AsyncClient(timeout=6.0) as client:
        response = await client.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        response.raise_for_status()
        data = response.json()
    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    lines = [
        _clean_story(line.lstrip("-*0123456789. ").strip())
        for line in text.splitlines()
        if len(line.strip()) >= 30 and not NEGATIVE_TERMS.search(line)
    ]
    return lines[:4]


async def get_uplifting_news_instructions(
    exa_api_key: str = "", gemini_api_key: str = ""
) -> list[str]:
    """Return 3-4 uplifting news digest strings (1..500 chars each) with safe caching and fallback."""
    exa_key = (exa_api_key or os.getenv("RE_EXA_API_KEY", "")).strip()
    gemini_key = (gemini_api_key or os.getenv("RE_GEMINI_API_KEY", "")).strip()
    if not exa_key:
        return list(FALLBACK_STORIES)

    fingerprint = f"{exa_key[:6]}:{gemini_key[:6]}"
    now_ts = time.monotonic()
    if (
        _CACHE["stories"]
        and _CACHE["key_fingerprint"] == fingerprint
        and (now_ts - _CACHE["fetched_at"]) < CACHE_TTL_SECONDS
    ):
        return list(_CACHE["stories"])

    try:
        candidates = await _fetch_exa_candidates(exa_key)
        stories: list[str] = []
        if gemini_key and candidates:
            try:
                stories = await _summarize_with_gemini(gemini_key, candidates)
            except (httpx.HTTPError, ValueError, KeyError, IndexError):
                stories = []
        if not stories and candidates:
            for item in candidates[:4]:
                title = item["title"]
                snippet = item["snippet"]
                combined = f"[Good News] {title} — {snippet}" if snippet else f"[Good News] {title}"
                stories.append(_clean_story(combined))
        if len(stories) >= 2:
            _CACHE["stories"] = stories[:4]
            _CACHE["fetched_at"] = now_ts
            _CACHE["key_fingerprint"] = fingerprint
            return list(_CACHE["stories"])
    except (httpx.HTTPError, ValueError, KeyError):
        return list(FALLBACK_STORIES)

    return list(FALLBACK_STORIES)
