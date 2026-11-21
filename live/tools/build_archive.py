#!/usr/bin/env python3
"""Bina aset arkib untuk tapak web MLBB Almanac.

Membaca dataset dalam `archive/` (repo mlbb-historical-database) dan menulis
JSON + imej ke `live/web/public/archive/`, supaya laman web boleh menyajikan
sejarah patch (87 versi), perubahan hero (350 baris), perubahan item (99 baris),
katalog item (104), dan jadual referensi (13) - semua dalam satu tempat.

Kandungan tapak yang asal (meta live: win rate, pick/ban, tier, snapshot)
tiada langsung disentuh - penjana ini hanya menambah lapisan arkib.

Untuk guna:
    python3 live/tools/build_archive.py
"""
from __future__ import annotations

import csv
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / "archive"
OUT = ROOT / "live" / "web" / "public" / "archive"
IMG_OUT = OUT / "img"

# Kolum yang dipaparkan di laman. Lajur lain dibuang supaya JSON kekal kecil.
HERO_CHANGE_COLUMNS = ["version", "date", "hero", "change_type", "detail", "source"]
ITEM_CHANGE_COLUMNS = ["version", "date", "item", "change_type", "detail", "source"]
HERO_COLUMNS = [
    "hero", "role", "lane", "release_version", "release_date", "price_bp",
    "price_diamond", "reworked_or_revamped", "total_buffs", "total_nerfs",
    "total_adjusts", "sources", "image_path",
]
ITEM_COLUMNS = [
    "item", "category", "price_gold", "build_path", "unique_passives", "sources", "image_path",
]

# Dokumen markdown yang dipaparkan di tab Data (rujukan / p intimidate).
DOCUMENTS = [
    ("glossary", "glossary.md", "Kamus Istilah"),
    ("meta_history", "meta_history.md", "Sejarah Meta"),
    ("timeline", "timeline.md", "Garis Masa"),
    ("academy_summary", "academy_summary.md", "Ringkasan Akademi"),
    ("research_report", "research_report.md", "Laporan Research"),
]

# Kumpulan imej yang disalin ke laman. `images/t1g/items/...` dalam CSV lama
# sudah dipindahkan ke `images/items/...` - jadi nama fail yang digunakan.
IMAGE_DIRS = ["items", "spells", "emblems"]


def read_csv(path: Path) -> list[dict[str, str]]:
    """Baca CSV dengan tolerate baris "ragged" (kolum lebih/kurang)."""
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle, restkey="__extra__", restval="")
        rows: list[dict[str, str]] = []
        for raw in reader:
            extra = raw.pop("__extra__", None)
            row = {k: (v if v is not None else "") for k, v in raw.items()}
            if extra:
                # Kolum berlebih dilipat ke lajur terakhir supaya tiada data hilang.
                keys = list(row.keys())
                if keys:
                    row[keys[-1]] = f"{row[keys[-1]]} {', '.join(str(x) for x in extra)}".strip()
            rows.append(row)
        return rows


def clean(value: str | None) -> str:
    return (value or "").strip()


def version_key(version: str) -> tuple:
    """Urutkan versi patch secara numerik: 2.2.16 > 2.2.9, bukan rentetan."""
    parts = re.findall(r"\d+", version or "")
    return tuple(int(p) for p in parts) or (0,)


def to_int(value: str) -> int:
    match = re.search(r"-?\d+", value or "")
    return int(match.group()) if match else 0


def resolve_image(source_path: str) -> str | None:
    """Cari fail imej sebenar untuk laluan dalam CSV, pulangkan URL relatif."""
    raw = clean(source_path)
    if not raw or raw == "MISSING_IMAGE":
        return None
    candidates = [raw]
    if raw.startswith("images/t1g/"):
        candidates.append(raw.replace("images/t1g/", "images/"))
    base = raw.split("/")[-1]
    candidates.extend(f"images/{folder}/{base}" for folder in IMAGE_DIRS)

    for candidate in candidates:
        source = ARCHIVE / candidate
        if source.exists():
            target = "archive/img/" + "/".join(candidate.split("/")[1:])
            return target
    return None


def copy_images(referenced: set[str]) -> dict[str, int]:
    """Salin imej rujukan + set lengkap (item, spell, emblem) ke output."""
    copied = 0
    skipped = 0

    wanted: dict[str, Path] = {}
    for rel in referenced:
        source = ARCHIVE / rel
        if source.exists():
            wanted[rel] = source
    for folder in IMAGE_DIRS:
        folder_dir = ARCHIVE / "images" / folder
        if not folder_dir.is_dir():
            continue
        for image in sorted(folder_dir.iterdir()):
            if image.is_file():
                wanted[f"images/{folder}/{image.name}"] = image

    for rel, source in sorted(wanted.items()):
        parts = rel.split("/")
        if len(parts) < 3:
            skipped += 1
            continue
        target = IMG_OUT.joinpath(*parts[1:])
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        copied += 1

    return {"copied": copied, "skipped": skipped}


def build() -> int:
    if not ARCHIVE.is_dir():
        print(f"error: direktori arkib tidak dijumpai: {ARCHIVE}", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------- patches
    patch_rows = read_csv(ARCHIVE / "patch_index.csv")
    hero_change_rows = read_csv(ARCHIVE / "hero_changes.csv")
    item_change_rows = read_csv(ARCHIVE / "item_changes.csv")
    hero_rows = read_csv(ARCHIVE / "hero_master.csv")
    item_rows = read_csv(ARCHIVE / "items_master.csv")

    hero_changes = [
        {col: clean(row.get(col)) for col in HERO_CHANGE_COLUMNS}
        for row in hero_change_rows
    ]
    item_changes = [
        {col: clean(row.get(col)) for col in ITEM_CHANGE_COLUMNS}
        for row in item_change_rows
    ]

    hero_by_version: dict[str, list[dict]] = {}
    for change in hero_changes:
        hero_by_version.setdefault(change["version"], []).append(change)
    item_by_version: dict[str, list[dict]] = {}
    for change in item_changes:
        item_by_version.setdefault(change["version"], []).append(change)

    patches = []
    for row in patch_rows:
        version = clean(row.get("version"))
        patches.append(
            {
                "version": version,
                "date": clean(row.get("date")),
                "source": clean(row.get("source")),
                "hero_change_count": len(hero_by_version.get(version, [])),
                "item_change_count": len(item_by_version.get(version, [])),
            }
        )
    patches.sort(key=lambda p: version_key(p["version"]))

    # -------------------------------------------------------------- heroes
    changes_per_hero: dict[str, list[dict]] = {}
    for change in hero_changes:
        changes_per_hero.setdefault(change["hero"], []).append(change)

    heroes = []
    for row in hero_rows:
        name = clean(row.get("hero"))
        history = sorted(
            changes_per_hero.get(name, []), key=lambda c: version_key(c["version"])
        )
        heroes.append(
            {
                **{col: clean(row.get(col)) for col in HERO_COLUMNS if col != "sources"},
                "total_buffs": to_int(row.get("total_buffs")),
                "total_nerfs": to_int(row.get("total_nerfs")),
                "total_adjusts": to_int(row.get("total_adjusts")),
                "change_count": len(history),
                "last_change_version": history[-1]["version"] if history else "",
                "last_change_type": history[-1]["change_type"] if history else "",
                "reworked": bool(clean(row.get("reworked_or_revamped"))),
                "sources": clean(row.get("sources")),
            }
        )
    heroes.sort(key=lambda h: h["hero"].lower())

    # --------------------------------------------------------------- items
    item_changes_per_item: dict[str, list[dict]] = {}
    for change in item_changes:
        item_changes_per_item.setdefault(change["item"], []).append(change)

    items = []
    for row in item_rows:
        name = clean(row.get("item"))
        history = sorted(
            item_changes_per_item.get(name, []), key=lambda c: version_key(c["version"])
        )
        image = resolve_image(row.get("image_path"))
        items.append(
            {
                **{col: clean(row.get(col)) for col in ITEM_COLUMNS if col != "sources"},
                "price_gold": to_int(row.get("price_gold")),
                "image": image,
                "change_count": len(history),
                "last_change_version": history[-1]["version"] if history else "",
                "last_change_type": history[-1]["change_type"] if history else "",
                "sources": clean(row.get("sources")),
            }
        )
    items.sort(key=lambda i: i["item"].lower())

    # ----------------------------------------------------------- reference
    tables = []
    ref_dir = ARCHIVE / "references"
    for csv_path in sorted(ref_dir.glob("*.csv")):
        rows = read_csv(csv_path)
        columns = list(rows[0].keys()) if rows else []
        tables.append(
            {
                "id": csv_path.stem,
                "label": csv_path.stem.replace("_", " ").title(),
                "file": f"references/{csv_path.name}",
                "columns": columns,
                "row_count": len(rows),
                "rows": rows,
            }
        )

    # --------------------------------------------------------------- docs
    docs = []
    referenced_images: set[str] = set()
    for doc_id, filename, title in DOCUMENTS:
        path = ARCHIVE / filename
        if not path.exists():
            continue
        markdown = path.read_text(encoding="utf-8")
        for match in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", markdown):
            rel = match.group(1)
            if rel.startswith("http"):
                continue
            resolved = resolve_image(rel)
            if resolved:
                referenced_images.add(rel if (ARCHIVE / rel).exists() else rel.replace("images/t1g/", "images/"))
                markdown = markdown.replace(rel, resolved)
        docs.append({"id": doc_id, "title": title, "file": filename, "markdown": markdown})

    image_stats = copy_images(referenced_images)

    # -------------------------------------------------------------- output
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "archive/ (mlbb-historical-database)",
        "counts": {
            "patches": len(patches),
            "hero_changes": len(hero_changes),
            "item_changes": len(item_changes),
            "heroes": len(heroes),
            "items": len(items),
            "reference_tables": len(tables),
            "documents": len(docs),
            "images": image_stats["copied"],
        },
    }

    def write(name: str, payload: object) -> None:
        path = OUT / name
        path.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        print(f"  {path.relative_to(ROOT)}  ({path.stat().st_size // 1024} KB)")

    print("Menjana aset arkib:")
    write("core.json", {"manifest": manifest, "patches": patches, "hero_changes": hero_changes, "item_changes": item_changes, "heroes": heroes, "items": items})
    write("reference.json", {"manifest": manifest, "tables": tables})
    write("docs.json", {"manifest": manifest, "docs": docs})

    skipped = image_stats["skipped"]
    suffix = f", {skipped} dilangkau" if skipped else ""
    print(f"  imej: {image_stats['copied']} disalin{suffix}")
    print(
        "  kandungan: "
        f"{len(patches)} patch, {len(hero_changes)} perubahan hero, "
        f"{len(item_changes)} perubahan item, {len(heroes)} hero, {len(items)} item, "
        f"{len(tables)} jadual referensi, {len(docs)} dokumen"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(build())
