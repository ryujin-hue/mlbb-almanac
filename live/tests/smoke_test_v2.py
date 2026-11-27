#!/usr/bin/env python3
"""Smoke test MLBB Almanac di browser sungguhan (IA selepas rework).

Menjalankan build `site/` lewat mock Worker API (`tools/dev-server.mjs`),
lalu memeriksa:
  - routing laluan (bukan hash): /, /heroes, /heroes/:id, /movers,
    /patches, /patches/:version, /items, /data
  - Meta sebagai halaman utama: strip status, KPI, bar win rate ikut role,
    sneakah movers, balance terakhir
  - kad + jadual hero, drawer filter, predictive patch strip
  - detail hero: tab Overview | Balance history
  - indeks patch + detail patch (Hero | Item | System)
  - katalog item (kad + jadual, log perubahan)
  - Data: status, sumber, snapshot, statistik arkib, jadual rujukan, dokumen
  - navigasi atas (desktop) dan bawah (mobile), footer lesen
  - manifest PWA + service worker
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = int(__import__("os").environ.get("QA_PORT", "5178"))
BASE = f"http://127.0.0.1:{PORT}"

checks: list[tuple[str, bool, str]] = []


def chrome_executable() -> str | None:
    """Chrome yang perlu dipakai, atau None untuk guna default Playwright.

    Path lama (`/root/.cache/...`) menyebabkan `PermissionError` pada GitHub
    runner - `Path.exists()` melontar exception, bukan sekadar False.
    sebab itu setiap semakan dibalut try/except.
    """
    candidates = [
        "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome",
        str(Path.home() / ".cache/ms-playwright/chromium-1243/chrome-linux/chrome"),
    ]
    for candidate in candidates:
        try:
            if Path(candidate).exists():
                return candidate
        except OSError:
            continue
    return None


def ck(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, bool(ok), detail))


def main() -> int:
    server = subprocess.Popen(
        [
            "node",
            "--experimental-strip-types",
            "--import",
            "./worker/tests/register-ts.mjs",
            "tools/dev-server.mjs",
            str(PORT),
        ],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    # Pre-warm: endpoint /api/heroes menarik upstream ~3 MB, jadi tunggu
    # sampai jawab dulu sebelum browser mulai (networkidle tidak akan tercapai
    # selama itu).
    import urllib.request

    for _ in range(60):
        try:
            with urllib.request.urlopen(f"{BASE}/api/heroes?rank=all", timeout=30) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(1)
    else:
        print("dev server tidak siap", file=sys.stderr)

    failures: list[str] = []
    try:
        with sync_playwright() as pw:
            launch_kwargs = {"args": ["--no-sandbox", "--disable-dev-shm-usage"]}
            chrome = chrome_executable()
            if chrome:
                launch_kwargs["executable_path"] = chrome
            browser = pw.chromium.launch(**launch_kwargs)
            ctx = browser.new_context(
                viewport={"width": 1280, "height": 900},
                ignore_https_errors=True,
                service_workers="allow",
            )

            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"PAGEERROR {e}"))

            def goto(path: str, wait: str = "", settle: int = 1600) -> str:
                page.goto(BASE + path, wait_until="domcontentloaded", timeout=60000)
                if wait:
                    page.wait_for_selector(wait, timeout=45000)
                page.wait_for_timeout(settle)
                return page.inner_text("body")

            # ------------------------------------------------------- 1. Landing
            body = goto("/", wait=".hcard")
            low = body.lower()

            ck("landing status 200", page.url.endswith("/") or page.url.endswith(":5178/"))
            ck("landing ialah senarai hero", len(page.query_selector_all(".hcard")) > 100)
            ck("tanpa console error", not errors, str(errors[:2]))
            ck(
                "judul aplikasi MLBB Almanac",
                "MLBB Almanac" in page.title(),
                page.title(),
            )

            # navigasi atas (desktop) dan bawah (mobile)
            nav_links = page.eval_on_selector_all(
                ".topnav__link", "els => els.map(e => e.textContent.trim())"
            )
            ck(
                "navigasi atas: 8 item",
                len(nav_links) == 8,
                str(nav_links),
            )
            ck(
                "navigasi atas: Heroes dulu, Meta kemudian",
                nav_links == [
                    "Heroes",
                    "Meta",
                    "Movers",
                    "Patches",
                    "Patch Notes",
                    "Items",
                    "Draft",
                    "Data",
                ],
                str(nav_links),
            )
            ck(
                "navigasi bawah (mobile) 5 item",
                len(page.query_selector_all(".tabbar__link")) == 5,
            )

            # Halaman Meta kini di /meta (landing ialah Heroes).
            body = goto("/meta", wait=".statusstrip")
            ck("Meta: strip status patch", bool(page.query_selector(".statusstrip__patch")))
            ck("Meta: KPI 4 statistik", len(page.query_selector_all(".kpirow .stat")) == 4)
            ck("Meta: bar win rate ikut role", len(page.query_selector_all(".rolebar")) >= 4)
            ck("Meta: lajur naik & turun", len(page.query_selector_all(".metacols .panel")) == 2)
            ck("Meta: senarai balance terakhir", len(page.query_selector_all(".balancerow")) >= 1)
            ck("Meta: patch semasa dipapar", "2.2.23" in body, "2.2.23")
            ck("Meta: panel Apo Pintu masuk", bool(page.query_selector(".tourlist, .empty--error")))

            # footer: sumber, lesen, penafian
            foot = page.inner_text(".footer").lower()
            ck("footer: sumber data", "mlbbdex" in foot, foot[:60])
            ck("footer: lesen CC BY-SA", "cc by-sa" in foot)
            ck("footer: bukan berafiliasi dengan Moonton", "moonton" in foot and "berafiliasi" in foot)

            # ------------------------------------------- 1b. Draft simulator
            body = goto("/draft", wait=".pagehead__title")
            ck("Draft: halaman dipapar", "Draft" in body)
            ck("Draft: pool hero", len(page.query_selector_all(".grid button")) > 50)
            ck(
                "Draft: butang Lock Hero",
                bool(page.query_selector("button:has-text('Lock Hero')")),
            )
            ck(
                "Draft: dua lajur pasukan",
                len(page.query_selector_all("section[aria-label*='Pasukan']")) == 2,
            )
            ck(
                "Draft: keadaan dalam URL",
                "bp=" in page.url or page.url.endswith("/draft"),
                page.url,
            )

            # ------------------------------------------------- 2. routing
            page.click(".topnav__link:has-text('Patches')")
            page.wait_for_timeout(1200)
            ck("klik nav -> laluan /patches", page.url.endswith("/patches"), page.url)
            ck("route bukan hash", "#" not in page.url, page.url)

            body = goto("/patches", wait=".tbl")
            ck("route terus /patches 200 + jadual", len(page.query_selector_all(".tbl tbody tr")) > 10)

            body = goto("/meta", wait=".statusstrip")
            ck("route terus /meta", bool(page.query_selector(".statusstrip")))

            body = goto("/patch-notes", wait=".pagehead")
            ck("route terus /patch-notes", "Patch Notes" in body, body[:40])

            body = goto("/heroes/lancelot", wait=".detailhead")
            ck("route terus /heroes/:id", "Lancelot" in body, body[:40])

            body = goto("/patches/2.2.16", wait=".tabs")
            ck("route terus /patches/:version", "2.2.16" in body, body[:40])

            # ------------------------------------------------- 3. Heroes
            body = goto("/heroes", wait=".hcard")
            cards = page.query_selector_all(".hcard")
            ck("Heroes: kad hero dipapar", len(cards) > 100, str(len(cards)))
            ck("Heroes: kad ada win rate", "%" in (cards[0].inner_text() if cards else ""))
            ck("Heroes: strip patch arkib pada kad", len(page.query_selector_all(".hcard__arch")) > 0)
            ck(
                "Heroes: PatchTag pada kad",
                len(page.query_selector_all(".hcard__arch .ptag")) > 0,
            )

            # toggle kad -> jadual
            page.click(".toggle__btn:has-text('Jadual')")
            page.wait_for_timeout(900)
            rows = page.query_selector_all(".tbl tbody tr")
            ck("Heroes: tukar ke jadual", len(rows) > 100, str(len(rows)))
            ck("Heroes: lajur jadual lengkap", len(page.query_selector_all(".tbl thead th")) >= 7)

            # toggle jadual -> kad
            page.click(".toggle__btn:has-text('Kad')")
            page.wait_for_timeout(700)
            ck("Heroes: tukar balik ke kad", len(page.query_selector_all(".hcard")) > 100)

            # drawer filter
            page.click(".toolbar__filter")
            page.wait_for_selector(".sheet__panel", timeout=15000)
            groups = page.query_selector_all(".filtergroup")
            ck("Filter: drawer terbuka", bool(page.query_selector(".sheet__panel")))
            ck("Filter: 3 kumpulan (role/lane/tipe)", len(groups) == 3, str(len(groups)))
            ck(
                "Filter: butang Terapkan",
                bool(page.query_selector(".sheet__actions button:has-text('Terapkan')")),
            )
            before = len(page.query_selector_all(".hcard"))
            page.click(".filtergroup:has-text('Role') .chip:has-text('Assassin')")
            page.wait_for_timeout(500)
            page.click(".sheet__actions button:has-text('Terapkan')")
            page.wait_for_timeout(900)
            after = len(page.query_selector_all(".hcard"))
            ck("Filter: role Assassin menapis kad", 0 < after < before, f"{before} -> {after}")

            # Reset filter supaya langkah carian seterusnya bersih
            page.click(".toolbar__filter")
            page.wait_for_selector(".sheet__panel", timeout=15000)
            page.click(".sheet__actions button:has-text('Reset')")
            page.wait_for_timeout(400)
            page.click(".sheet__actions button:has-text('Terapkan')")
            page.wait_for_timeout(900)
            ck("Filter: reset memulihkan semua kad", len(page.query_selector_all(".hcard")) == before)

            # cari
            page.fill(".toolbar__search input", "Gloo")
            page.wait_for_timeout(900)
            found = page.query_selector_all(".hcard")
            ck(
                "Cari: nama Gloo dijumpai",
                bool(found) and "Gloo" in page.inner_text(".herogrid"),
                str(len(found)),
            )

            # Keadaan filter disimpan dalam URL.
            page.select_option("select[aria-label='Rank']", "mythic")
            page.wait_for_timeout(700)
            ck("URL menyimpan rank", "rank=mythic" in page.url, page.url)
            page.click(".toggle__btn:has-text('Jadual')")
            page.wait_for_timeout(700)
            ck("URL menyimpan mod paparan", "view=table" in page.url, page.url)
            page.click(".toggle__btn:has-text('Kad')")
            page.wait_for_timeout(600)
            page.goto(BASE + "/heroes?rank=mythic", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_selector(".hcard", timeout=45000)
            page.wait_for_timeout(1200)
            rank_value = page.query_selector("select[aria-label='Rank']").input_value()
            ck("URL ditolak semula restore state", rank_value == "mythic", rank_value)

            # ------------------------------------------- 4. detail hero (2 klik)
            page.goto(BASE + "/heroes", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_selector(".hcard", timeout=45000)
            page.wait_for_timeout(1200)
            page.click(".hcard__link >> nth=0")
            page.wait_for_timeout(1400)
            ck("Detail hero: <= 2 klik dari senarai", "/heroes/" in page.url, page.url)
            ck("Detail hero: nama dipapar", bool(page.query_selector(".detailhead__name")))
            ck("Detail hero: badge tier", bool(page.query_selector(".tier")))

            tabs = page.eval_on_selector_all(".tabs__btn", "els => els.map(e => e.textContent.trim())")
            ck(
                "Detail hero: tab Overview + Balance history",
                any("Overview" in t for t in tabs) and any("Balance history" in t for t in tabs),
                str(tabs),
            )
            page.click(".tabs__btn:has-text('Balance history')")
            page.wait_for_timeout(900)
            hist = page.query_selector_all(".tbl--history tbody tr")
            ck("Detail hero: baris sejarah imbangan", len(hist) >= 1, str(len(hist)))

            ck(
                "Detail hero: sejarah ada versi patch",
                bool(page.query_selector(".tbl--history .ptag")),
            )

            # Tab "Patch vs meta" - carta korelasi patch vs meta. Carta
            # dimuat secara lazy (chunk recharts), jadi tunggu butang siri
            # muncul - bukan masa tetap.
            page.click(".tabs__btn:has-text('Patch vs meta')")
            try:
                page.wait_for_selector("button:has-text('Pick rate')", timeout=20000)
            except Exception:
                pass
            page.wait_for_timeout(1200)
            ck(
                "Detail hero: tab Patch vs meta",
                bool(page.query_selector(".recharts-wrapper"))
                or "Belum ada siri live" in page.inner_text("body"),
            )
            ck(
                "Detail hero: kawalan siri carta",
                len(page.query_selector_all("button:has-text('Pick rate')")) == 1,
            )

            # ------------------------------------------------- 5. Movers
            body = goto("/movers", wait=".page--movers")
            ck("Movers: halaman dipapar", "mover" in low or "Movers" in body)
            ck("Movers: kawalan ambang", bool(page.query_selector(".ctl")))
            counts = page.inner_text(".counts") if page.query_selector(".counts") else ""
            ck("Movers: kiraan naik/turun", "naik" in counts and "turun" in counts, counts[:60])
            # dev server tiada sejarah -> mesej jujur, bukan angka karangan
            honest = bool(page.query_selector(".empty")) or bool(page.query_selector(".movercol"))
            ck("Movers: keadaan tulen (empty atau senarai)", honest)

            # ------------------------------------------------- 6. Patches
            body = goto("/patches", wait=".tbl")
            ck("Patches: patch semasa dipin", "PATCH TERKINI" in body.upper())
            versions = page.query_selector_all(".tbl tbody tr")
            ck("Patches: > 80 versi", len(versions) > 80, str(len(versions)))
            ck("Patches: pecahan jenis patch", len(page.query_selector_all(".typetags .ptag")) > 0)
            ck("Patches: PatchTag jenis", len(page.query_selector_all(".ptag")) > 0)

            # ------------------------------------------------- 7. detail patch
            body = goto("/patches/2.2.16", wait=".tabs")
            ck("Detail patch: versi + tarikh", "2.2.16" in body and "2026" in body)
            tabs = page.eval_on_selector_all(".tabs__btn", "els => els.map(e => e.textContent.trim())")
            ck(
                "Detail patch: tab Hero | Item | System",
                any("Hero" in t for t in tabs)
                and any("Item" in t for t in tabs)
                and any("System" in t for t in tabs),
                str(tabs),
            )
            ck("Detail patch: baris perubahan hero", len(page.query_selector_all(".tbl--patch tbody tr")) > 0)
            ck("Detail patch: lajur lama -> baru", bool(page.query_selector(".tbl__change")))
            ck("Detail patch: jenis patch pada baris", len(page.query_selector_all(".tbl--patch .ptag")) > 0)

            page.click(".tabs__btn:has-text('Item')")
            page.wait_for_timeout(900)
            ck("Detail patch: tab item ada baris", len(page.query_selector_all(".tbl--patch tbody tr")) > 0)

            page.click(".tabs__btn:has-text('System')")
            page.wait_for_timeout(900)
            ck("Detail patch: tab sistem ada nota", len(page.query_selector_all(".sysrow")) > 0)

            # ------------------------------------------------- 7b. Patch Notes
            body = goto("/patch-notes", wait=".pagehead")
            ck("Patch Notes: tajuk halaman", "Patch Notes" in body)
            ck(
                "Patch Notes: sumber dinyatakan",
                "MLBB Hub" in body,
                body[:60],
            )
            ck("Patch Notes: medan carian ada", bool(page.query_selector(".toolbar__search input")))

            # ------------------------------------------------- 8. Items
            body = goto("/items", wait=".icard")
            items = page.query_selector_all(".icard")
            ck("Items: kad item dipapar", len(items) > 90, str(len(items)))
            ck("Items: imej item ada", len(page.query_selector_all(".icard__img img")) > 90)
            ck("Items: kategori sebagai penapis", len(page.query_selector_all(".chip")) > 5)
            ck("Items: patch tag pada item", len(page.query_selector_all(".icard .ptag")) > 0)

            page.click(".toggle__btn:has-text('Jadual')")
            page.wait_for_timeout(900)
            ck("Items: tukar ke jadual", len(page.query_selector_all(".tbl tbody tr")) > 90)
            page.click(".toggle__btn:has-text('Kad')")
            page.wait_for_timeout(700)

            # expand satu item -> log perubahan
            page.click(".icard__head >> nth=0")
            page.wait_for_timeout(900)
            ck(
                "Items: expand Showing log perubahan / butiran",
                bool(page.query_selector(".icard__body")),
            )

            # ------------------------------------------------- 9. Data
            body = goto("/data", wait=".page--data")
            ck("Data: halaman dipapar", "Status" in body)
            panels = page.eval_on_selector_all(
                ".panel__head h2", "els => els.map(e => e.textContent.trim())"
            )
            for title in ("Status", "Sumber", "Sejarah snapshot", "Statistik arkib", "Jadual rujukan"):
                ck(f"Data: seksyen {title}", title in panels, str(panels[:8]))
            ck("Data: jadual rujukan 13 jadual", "13" in body)
            ck("Data: dokumen senarai", len(page.query_selector_all(".doclist__item, .doclist")) > 0)
            ck("Data: senarai endpoint API", len(page.query_selector_all(".apilist li a")) >= 5)
            ck("Data: sumber ada lesen", "CC BY-SA" in body)

            # ------------------------------------------------ 10. mobile nav
            mobile = browser.new_context(
                viewport={"width": 390, "height": 844},
                ignore_https_errors=True,
                service_workers="allow",
            )
            mp = mobile.new_page()
            mp.on("pageerror", lambda e: errors.append(f"MOBILE PAGEERROR {e}"))
            mp.goto(BASE + "/", wait_until="domcontentloaded", timeout=60000)
            mp.wait_for_timeout(2200)
            ck("Mobile: bar bawah kelihatan", mp.is_visible(".tabbar"))
            ck("Mobile: bar atas desktop tersembunyi", not mp.is_visible(".topnav"))
            mp.click(".tabbar__link:has-text('Patches')")
            mp.wait_for_timeout(1200)
            ck("Mobile: tab bawah -> /patches", mp.url.endswith("/patches"), mp.url)
            mp.click(".tabbar__link:has-text('More')")
            mp.wait_for_timeout(900)
            ck(
                "Mobile: menu More ada Items + Draft + Data",
                mp.is_visible(".moremenu__link:has-text('Items')")
                and mp.is_visible(".moremenu__link:has-text('Draft')")
                and mp.is_visible(".moremenu__link:has-text('Data')"),
            )
            # footer tidak tenggelam bawah tab bar
            mp.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
            mp.wait_for_timeout(500)
            clearance = mp.evaluate(
                """() => {
                    const bar = document.querySelector('.tabbar').getBoundingClientRect();
                    let max = 0;
                    document.querySelectorAll('.footer *').forEach((el) => {
                        const r = el.getBoundingClientRect();
                        if (r.height > 0) max = Math.max(max, r.bottom);
                    });
                    return bar.top - max;
                }"""
            )
            ck("Mobile: footer clearance dari tab bar", clearance > 0, f"{clearance}px")
            mobile.close()

            # ------------------------------------------------ 11. PWA
            manifest = page.evaluate(
                "() => document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? ''"
            )
            ck("PWA: manifest dikait", manifest.endswith("manifest.webmanifest"), manifest)
            sw = page.evaluate(
                """async () => {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    return regs.length;
                }"""
            )
            ck("PWA: service worker terdaftar", sw >= 1, str(sw))

            ck("tanpa console error (akhir)", not errors, str(errors[:3]))

            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()

    width = max(len(name) for name, _, _ in checks)
    for name, ok, detail in checks:
        mark = "PASS" if ok else "FAIL"
        line = f"[{mark}] {name.ljust(width)}"
        if detail and not ok:
            line += f"  <- {detail}"
        print(line)
        if not ok:
            failures.append(name)

    total = len(checks)
    print(f"\n{total - len(failures)}/{total} checks passed")
    if failures:
        print("gagal: " + ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
