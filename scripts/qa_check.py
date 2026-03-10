#!/usr/bin/env python3
"""Basic QA checks for the static Digital InPulse project."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT_FILE = ROOT / "public" / "content" / "site.json"

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


def main() -> int:
    if not CONTENT_FILE.exists():
        fail(f"Missing content file: {CONTENT_FILE}")

    content = read_json(CONTENT_FILE)
    pass_log("Content JSON is valid")

    for route, file_path in REQUIRED_ROUTES.items():
        if not file_path.exists():
            fail(f"Missing route file for {route}: {file_path}")
    pass_log("All required route files exist")

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
    if not any("REGLEMENT-DIP-2025.pdf" in str(url) for url in link_urls):
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

    print("[PASS] QA checks completed successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
