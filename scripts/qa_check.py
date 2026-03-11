#!/usr/bin/env python3
"""Basic QA checks for the static Digital InPulse project."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT_FILE = ROOT / "public" / "content" / "site.json"
NETLIFY_TOML = ROOT / "netlify.toml"
SUBMISSIONS_CONFIG = ROOT / "netlify" / "functions" / "_submissions.js"
ROBOTS_FILE = ROOT / "public" / "robots.txt"
SITEMAP_FILE = ROOT / "public" / "sitemap.xml"
NOT_FOUND_FILE = ROOT / "public" / "404.html"

REQUIRED_ROUTES = {
    "/": ROOT / "public" / "index.html",
    "/digital-in-pulse/": ROOT / "public" / "digital-in-pulse" / "index.html",
    "/le-principe/": ROOT / "public" / "le-principe" / "index.html",
    "/tech-for-competitivity/": ROOT / "public" / "tech-for-competitivity" / "index.html",
    "/women-for-innovation/": ROOT / "public" / "women-for-innovation" / "index.html",
    "/mentions-legales/": ROOT / "public" / "mentions-legales" / "index.html",
    "/conditions-generales-dutilisation/": ROOT / "public" / "conditions-generales-dutilisation" / "index.html",
    "/politique-relative-a-lutilisation-des-cookies/": ROOT
    / "public"
    / "politique-relative-a-lutilisation-des-cookies"
    / "index.html",
    "/politique-de-confidentialite/": ROOT / "public" / "politique-de-confidentialite" / "index.html",
    "/admin/": ROOT / "public" / "admin" / "index.html",
}

SEO_MARKERS = (
    'name="description"',
    'rel="canonical"',
    'property="og:title"',
    'name="twitter:card"',
    'rel="icon"',
)


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise SystemExit(1)


def pass_log(message: str) -> None:
    print(f"[PASS] {message}")


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover
        fail(f"JSON parse error in {path}: {exc}")
    return {}


def stringify(node) -> str:
    if isinstance(node, dict):
        return " ".join(stringify(value) for value in node.values())
    if isinstance(node, list):
        return " ".join(stringify(value) for value in node)
    return str(node)


def collect_media_paths(node) -> set[str]:
    paths: set[str] = set()
    if isinstance(node, dict):
        for value in node.values():
            paths.update(collect_media_paths(value))
    elif isinstance(node, list):
        for value in node:
            paths.update(collect_media_paths(value))
    elif isinstance(node, str) and node.startswith("/assets/media/"):
        paths.add(node)
    return paths


def main() -> int:
    if not CONTENT_FILE.exists():
        fail(f"Missing content file: {CONTENT_FILE}")

    content = read_json(CONTENT_FILE)
    pass_log("Content JSON is valid")

    for route, file_path in REQUIRED_ROUTES.items():
        if not file_path.exists():
            fail(f"Missing route file for {route}: {file_path}")
    pass_log("All required route files exist")

    if not ROBOTS_FILE.exists():
        fail(f"Missing robots.txt: {ROBOTS_FILE}")
    if not SITEMAP_FILE.exists():
        fail(f"Missing sitemap.xml: {SITEMAP_FILE}")
    if not NOT_FOUND_FILE.exists():
        fail(f"Missing custom 404 page: {NOT_FOUND_FILE}")
    pass_log("Robots, sitemap and custom 404 files exist")

    pages = content.get("pages", {})
    for key in ("tech_for_competitivity", "women_for_innovation"):
        page_payload = stringify(pages.get(key, {}))
        if "2024" in page_payload:
            fail(f"Legacy year detected in page '{key}'")
    pass_log("No legacy 2024 residue in program pages")

    legal_links = content.get("footer", {}).get("legalLinks", [])
    link_urls = {entry.get("url") for entry in legal_links}
    if "/politique-de-confidentialite/" not in link_urls:
        fail("Footer legal links missing privacy policy route")
    if not any("reglement-dip-2025.pdf" in str(url).lower() for url in link_urls):
        fail("Footer legal links missing regulation PDF")
    pass_log("Legal links include privacy policy and regulation PDF")

    contact_email = content.get("meta", {}).get("contactEmail", "")
    if "@" not in contact_email:
        fail("Invalid contact email format in meta.contactEmail")
    pass_log("Contact email format is valid")

    navigation = content.get("navigation", [])
    if len(navigation) < 4:
        fail("Main navigation has fewer than 4 entries")
    pass_log("Main navigation structure looks correct")

    for route, file_path in REQUIRED_ROUTES.items():
        if route == "/admin/":
            continue
        html = file_path.read_text(encoding="utf-8")
        for marker in SEO_MARKERS:
            if marker not in html:
                fail(f"Missing SEO marker {marker} in {file_path}")
    admin_html = REQUIRED_ROUTES["/admin/"].read_text(encoding="utf-8")
    if 'name="robots" content="noindex,nofollow,noarchive"' not in admin_html:
        fail("Admin page missing noindex robots tag")
    pass_log("SEO meta markers are present on public pages and admin is noindexed")

    robots_text = ROBOTS_FILE.read_text(encoding="utf-8")
    if "Disallow: /admin/" not in robots_text:
        fail("robots.txt must disallow /admin/")
    if "Sitemap: https://digitalinpulse.netlify.app/sitemap.xml" not in robots_text:
        fail("robots.txt missing sitemap declaration")
    pass_log("robots.txt contains admin disallow and sitemap")

    sitemap_text = SITEMAP_FILE.read_text(encoding="utf-8")
    for route in REQUIRED_ROUTES:
        if route == "/admin/":
            continue
        if f"<loc>https://digitalinpulse.netlify.app{route}</loc>" not in sitemap_text:
            fail(f"sitemap.xml missing route {route}")
    pass_log("sitemap.xml includes all public routes")

    asset_refs = collect_media_paths(content)
    missing_assets = []
    for asset_path in sorted(asset_refs):
        file_path = ROOT / "public" / asset_path.lstrip("/")
        if not file_path.exists():
            missing_assets.append(asset_path)
    if missing_assets:
        fail(f"Missing local media assets referenced in content: {', '.join(missing_assets)}")
    pass_log("All local media assets referenced in content exist")

    hotlink_targets = (
        ROOT / "public" / "content" / "site.json",
        ROOT / "public" / "assets" / "js" / "site.js",
    )
    for file_path in hotlink_targets:
        text = file_path.read_text(encoding="utf-8")
        if "digitalinpulse.com/wp-content/uploads" in text:
            fail(f"Remote hotlinked asset still present in {file_path}")
    pass_log("Critical content/assets no longer hotlink the source site")

    netlify_text = NETLIFY_TOML.read_text(encoding="utf-8")
    for marker in ("Content-Security-Policy", "X-Robots-Tag", 'for = "/content/site.json"'):
        if marker not in netlify_text:
            fail(f"netlify.toml missing marker: {marker}")
    pass_log("Netlify headers include security, admin noindex and content no-store")

    submissions_text = SUBMISSIONS_CONFIG.read_text(encoding="utf-8")
    if "allowedEmails: base.allowedEmails" not in submissions_text:
        fail("_submissions.js must forward allowedEmails from base config")
    pass_log("Submission config forwards allowedEmails for admin gating")

    print("[PASS] QA checks completed successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
