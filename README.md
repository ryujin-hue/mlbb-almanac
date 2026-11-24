<div align="center">

<img src="docs/brand/assets/mlbb-a.svg" alt="MLBB Almanac" width="420" />

# MLBB Almanac

**Every patch since 2016 and today's live meta, in one almanac.**

[![Live](https://img.shields.io/badge/live-mlbb--almanac.pages.dev-00E5FF)](https://mlbb-almanac.pages.dev)
[![Worker](https://img.shields.io/badge/worker-mlbb--data--workflow.mlvv.workers.dev-F5C518)](https://mlbb-data-workflow.mlvv.workers.dev)
[![License](https://img.shields.io/badge/data-CC%20BY--SA%204.0-2ea44f)](https://creativecommons.org/licenses/by-sa/4.0/)

</div>

---

A reference for **Mobile Legends: Bang Bang** that keeps two things that are
usually kept apart in the same table:

| | Layer | Shape | Freshness |
|---|---|---|---|
| **Then** | Patch history | 87 versions since 2016 (1.1.23.109.1 → 2.2.23), 350 hero changes, 99 item changes, 133 heroes, 104 items, 13 reference tables, 5 documents | daily auto-update |
| **Now** | Live meta | 133 heroes with win/pick/ban rate, tier, daily snapshots | hourly refresh, daily snapshot |

The live entry is the last one in the same row. That is the whole idea: a hero
card shows its win rate *and* the patch that last touched it; a hero's profile
shows today's numbers *and* every buff and nerf it has been through.

## Read it

| | |
|---|---|
| **Live site** | <https://mlbb-almanac.pages.dev> |
| **Worker** (API + KV) | <https://mlbb-data-workflow.mlvv.workers.dev> |
| **Archive API** | 78 REST endpoints — run locally, see `archive/API.md` |

### The routes

`/` is the hero list — the page you land on. The top bar (desktop) and the
bottom bar (mobile) put **Heroes first, Meta second**: the hero list is the
daily work, the meta summary is the reference.

| Route | What it answers |
|---|---|
| `/` `/heroes` **Heroes** | Who is strong right now — rates, tier, trend, last patch note. Cards or a sortable table; filters for role, lane and damage type. |
| `/meta` **Meta** | Where the game stands right now: current patch, four headline numbers, win rate per role, who rose and fell, the latest balance notes, and the esports calendar. |
| `/movers` **Movers** | Who moved in the last 1 / 7 / 30 days, with a settable delta threshold. |
| `/patches` **Patches** | Every patch version since 2016, with a per-patch breakdown of what kind of change it carried. |
| `/patches/<version>` | One patch: what changed, per hero and per item, with the old value next to the new one, plus any MLBB Hub article on that version. |
| `/patch-notes` **Patch Notes** | Patch notes written by MLBB Hub, linked to the archive version they cover. |
| `/items` **Items** | The 104-item shop: category, gold cost, build path, unique passive, and the change log for each item. |
| `/data` **Data** | Live dataset status and snapshot history, the archive (13 reference tables, 5 documents), and the API catalogue. |

Routing is by path, not by hash, so every page has its own URL. Filter state
(rank, sort, search, role/lane/damage, card vs table) lives in the query
string too — every view can be shared, and the browser back button works.

## Layout

```
archive/            Patch history, heroes, items, references  (was mlbb-historical-database)
  api/              FastAPI - 78 endpoints, static JSON mirror
  scripts/          update_data.py (daily updater), build_api_artifacts.py
  tests/            pytest suite
  *.csv             patch_index, hero_changes, item_changes, hero_master, items_master
  references/       13 lookup tables
  images/           734 sourced images

live/               Worker + web app  (was mlbb-data-workflow)
  web/              React + Vite - the site
  worker/           Cloudflare Worker: KV, 02:00 UTC cron, the API
  pages/            Pages Functions - proxies /api/* and /audio/* to the Worker
  tools/            dev-server.mjs (mock API), build_archive.py (archive -> JSON)
  tests/            smoke_test_v2.py (88 checks), production_check.py (live probe)

packages/shared/    Code shared by worker and web (tier maths, types)
docs/               Brand identity, architecture notes
```

## How the two layers meet

```
archive/*.csv ──> live/tools/build_archive.py ──> live/web/public/archive/*.json
                                                          │
                    MLBBDex mirror ──> Worker (KV) ───────┴──> Pages Functions ──> Browser
```

The archive lives in the same repository, so the site can compile it into
static JSON during the build. No second API to host, no sync job, no chance
of the history and the live data drifting apart.

```bash
cd live && python3 tools/build_archive.py    # archive/*.csv -> web/public/archive/
```

## Run it locally

```bash
# 1. archive -> JSON
cd live && python3 tools/build_archive.py

# 2. build the site
cd web && npm install && npm run build

# 3. serve it with a mock of the Worker API (no Cloudflare needed)
cd .. && node --experimental-strip-types --import ./worker/tests/register-ts.mjs \
    tools/dev-server.mjs 5178
```

## Check it

```bash
cd live
python3 tests/smoke_test_v2.py                                        # 88 checks, browser
QA_BASE=https://mlbb-almanac.pages.dev python3 tests/production_check.py   # 70 checks, live
cd ../archive && python3 -m pytest tests/ -q                           # archive suite
```

## CI

| Workflow | When | What |
|---|---|---|
| `auto-update` | cron 18:00 UTC | refresh the archive datasets, commit `[auto-update]` |
| `QA Site` | every push | worker unit tests, typecheck, build, 88-check smoke test |
| `QA Production` | cron 03:00 UTC | probe against both live URLs |
| `Deploy Pages` | push | `live/` -> Cloudflare Pages |
| `Deploy Worker + Site` | push | `live/worker` -> Cloudflare Workers |

Both Cloudflare deploys share one concurrency group (`cloudflare-deploy`) —
two deploys at once trip the API rate limit (code 10429).

## Brand

The wordmark is folded-paper origami in gold and silver, drawn as polygons:
`docs/brand/assets/mlbb-a.svg`. It reads as one line of type, so the site
header needs no separate wordmark text beside it. The 12-cell mark stays as
the small icon — favicon, PWA icon, app tile — because origami does not
survive 16px.

Identity, palette, voice and taglines live in
[`docs/brand/identity.md`](docs/brand/identity.md); the visual board is
[`docs/brand/board.html`](docs/brand/board.html).

## Data, sources, honesty

- Live rates come from the [MLBBDex mirror](https://github.com/achedon12/mlbb)
  (CC BY-SA 4.0 via Mobile Legends Wiki).
- Every archive row carries its own source URL; values that could not be
  cross-verified are flagged `UNVERIFIED` in-band rather than smoothed over.
- The live site is the only place the two are combined, so nothing here has
  to be trusted twice.
- Not affiliated with Moonton.

## Related repositories

Both were consolidated into this one. They remain readable, and their
auto-update and QA workflows still run, but deploys are disabled there so an
old push cannot overwrite the live site.

- [`mlbb-data-workflow`](https://github.com/ryujin-hue/mlbb-data-workflow) — now `live/`
- [`mlbb-historical-database`](https://github.com/ryujin-hue/mlbb-historical-database) — now `archive/`
