#!/usr/bin/env python3
"""Ekstrak patch notes MLBB Hub -> JSON untuk Worker.

Sumber: https://mlbbhub.com/news/ (robots.txt membenarkan /news/; /api/
dilarang, jadi fail ini tidak pernah memanggil API mereka).

Aliran:
  1.sitemap news -> semua URL artikel
  2. tapis URL patch (slug mengandungi "patch")
  3. setiap artikel -> ld+json (headline, tarikh, ringkasan, gambar) +
     badan teks dari <article class="prose-article">
  4. padankan versi patch (2.1.70) supaya arkib boleh pautkan
  5. tulis JSON untuk Worker (<= N artikel terkini)

Jalankan:
    python3 tools/fetch_patch_notes.py --out ../web/public/patch-notes.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html import unescape

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
SITEMAP = "https://mlbbhub.com/news/sitemap.xml"
NEWS_BASE = "https://mlbbhub.com/news/"

# Versi patch: 2.1.70, 2.2.16a, 1.9.90
VERSION_RE = re.compile(r"\b(\d+\.\d+\.\d+[a-z]?)\b")

# Blok yang bukan kandungan artikel: iklan, CSS inline, butang kongsi.
DROP_RE = re.compile(
    r"\{min-width|Advertisement|^\s*Share Save\s*$|self\.__next_s|</?script|</?style",
    re.IGNORECASE,
)


def fetch(url: str, timeout: int = 45) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urllib.request.urlopen(request, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def sitemap_urls() -> list[str]:
    xml = fetch(SITEMAP)
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def clean_text(raw: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"\s+", " ", text).strip()
    return text


def article_body(html: str) -> list[dict]:
    """Kumpul blok kandungan daripada <article> + prose-article."""
    match = re.search(r"<article\b.*?</article>", html, re.S | re.I)
    region = match.group(0) if match else html
    blocks: list[dict] = []
    seen: set[str] = set()

    for tag, raw in re.findall(r"<(h2|h3|h4|p|li)\b[^>]*>(.*?)</\1>", region, re.S | re.I):
        text = clean_text(raw)
        if len(text) < 12 or DROP_RE.search(text):
            continue
        if text in seen:
            continue
        seen.add(text)
        blocks.append({"kind": "h" if tag.startswith("h") else "p", "text": text})

    images: list[str] = []
    for src in re.findall(r'<img[^>]+src="([^"]+)"', region):
        if src.startswith("http") and src not in images and "logo" not in src.lower():
            images.append(src)

    return blocks, images[:4]


def ld_json(html: str) -> dict:
    for raw in re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.S
    ):
        try:
            data = json.loads(raw.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(data, dict) and data.get("@type") in ("NewsArticle", "Article", "BlogPosting"):
            return data
    return {}


def iso(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


def parse_article(url: str) -> dict | None:
    html = fetch(url)
    meta = ld_json(html)
    if not meta:
        return None
    blocks, images = article_body(html)
    headline = clean_text(str(meta.get("headline") or ""))
    if not headline:
        return None

    version_match = VERSION_RE.search(headline)
    image = images[0] if images else None
    if not image:
        raw_image = (meta.get("image") or {})
        if isinstance(raw_image, dict):
            image = raw_image.get("url")
        elif isinstance(raw_image, list) and raw_image:
            image = raw_image[0].get("url") if isinstance(raw_image[0], dict) else str(raw_image[0])

    published = iso(meta.get("datePublished"))
    summary = clean_text(str(meta.get("description") or ""))
    if not summary and blocks:
        summary = blocks[0]["text"]

    return {
        "version": version_match.group(1) if version_match else None,
        "title": headline,
        "url": url,
        "published_at": published,
        "summary": summary,
        "image": image,
        "author": "",
        "blocks": blocks[:80],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="")
    parser.add_argument("--limit", type=int, default=40)
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    urls = sitemap_urls()
    patch_urls = [u for u in urls if "/news/" in u and "patch" in u.rsplit("/", 1)[-1].lower()]
    print(f"sitemap: {len(urls)} URL, {len(patch_urls)} artikel patch", file=sys.stderr)

    articles: list[dict] = []
    for url in patch_urls:
        try:
            item = parse_article(url)
        except (urllib.error.URLError, TimeoutError, ValueError) as err:
            print(f"  gagal {url.rsplit('/', 1)[-1][:60]}: {err}", file=sys.stderr)
            continue
        if not item:
            continue
        articles.append(item)
        print(f"  + {item['published_at'] or '?'} {item['version'] or '-':<8} {item['title'][:60]}", file=sys.stderr)
        time.sleep(0.4)

    articles.sort(key=lambda a: (a.get("published_at") or ""), reverse=True)
    articles = articles[: args.limit]

    payload = {
        "source": "MLBB Hub (mlbbhub.com)",
        "source_url": "https://mlbbhub.com/news/",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(articles),
        "articles": articles,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=1)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(text)
        print(f"tulis {args.out} ({len(text) / 1024:.0f} KB, {len(articles)} artikel)", file=sys.stderr)
    else:
        print(text[:2000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
