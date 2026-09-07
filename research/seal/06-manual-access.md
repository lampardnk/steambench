# 06 — Access status

Updated after you supplied a Bilibili `SESSDATA`, the NGA workaround, and yt-dlp.
**All three unlocked.** This file is now a status record + how to re-run.

## ✅ 1. Bilibili authenticated session — DONE

Login verified (`isLogin: true`, account `bili_25417839993`). What it produced:

- **His complete dynamic feed: 721 posts, 2021-08-11 → 2026-09-06.**
  This was the single biggest win — it contains his own dated announcement of the
  50-streak (2026-08-15) and turned the record from "community-reported" into
  primary-sourced. → `data/dynamics.csv`, written up in `07-timeline.md`.
- Authenticated video-stream access up to 1080p for yt-dlp.

**Credential handling**: the SESSDATA is stored **outside this repo**, in the session
scratchpad (`sessdata.txt`, mode 600), and a `.gitignore` here excludes `vods/` and any
cookie file. Nothing in `research/seal/` contains your session token. Bilibili
SESSDATA is long-lived — **revoke it by logging out of that browser session** when
you're done if you'd rather not leave it valid.

## ✅ 2. NGA — DONE (and it changed a conclusion)

Your click-through tip was right about the mechanism, but the guard also needs real JS
execution — replicating the `guestJs` cookie by hand still 403s. I drove a real
browser through it instead and got the thread.

**Result — thread `tid=45494435`, all 8 posts:**

```
目前nosl世界连胜记录：
铁甲战士 XecnaR 24连 / 静默猎手 XecnaR 27连 / 故障机器人 XecnaR 29连
观者 OnePunMan_ 57连(还没有断) / 轮换 XecnaR 26连
```
- OP confirms in reply #3 these are **STS1 A20 heart-kill NoSL** (`是，进阶20碎心nosl`).
- OP updated Watcher to **64** on 2025-11-12.
- **No mention of 白夕, STS2, or the 50 anywhere in the thread.**

**So my earlier "de-facto ledger" framing was wrong and is now corrected in
`02-records.md` and `05-scene.md`.** NGA is a stale STS1 snapshot, not a live board.
**There is no ratification body for STS2 NoSL streaks** — the record rests on his own
published VODs plus community consensus. That's worth knowing before describing the
50 as an "official" world record anywhere.

## ✅ 3. yt-dlp — working

Needs more than cookies: Bilibili 412s without a browser UA **and** `buvid3`/`buvid4`
fingerprint cookies alongside SESSDATA. Working invocation:

```bash
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
yt-dlp --cookies /tmp/bili_cookies.txt --user-agent "$UA" --referer 'https://www.bilibili.com/' \
  --playlist-items 25-74 \
  -f 'bv*[height<=1080][vcodec^=hvc]+ba/bv*[height<=1080]+ba/b' \
  --merge-output-format mp4 \
  -o '%(playlist_index)03d - %(title)s.%(ext)s' \
  'https://www.bilibili.com/video/BV1SxGM66ESZ'
```

**Two gotchas found the hard way:**

1. **The HEVC streams are broken on this CDN.** Format `30077` (hvc1 1080p) returns
   496 bytes and aborts — `Got error: 496 bytes read, 494984158 more expected`,
   through all 10 retries. Audio downloads fine; only the HEVC video track fails.
   **Use AV1 (`100026` = av01 1080p) instead** — it works, and it's *smaller*
   (~412 MB vs ~472 MB). H.264 `30080` works too but is 1.03 GB.
   Recommended selector:
   `-f 'bv*[height<=1080][vcodec^=av01]+ba/bv*[height<=1080][vcodec^=avc]+ba/b'`
2. **412s on the metadata endpoint are transient rate-limiting**, not a hard block —
   retry, or space requests out. Don't chase it as an auth problem.

The account is not premium, so **1080P60 is unavailable**; 1080p30 is.

### Realistic throughput — read this before starting a bulk pull
Measured **~0.3 MB/s** (~18 MB/min) from the Bilibili CDN here. That means:

| Target | Size | Time at measured rate |
|---|---|---|
| One run @ 1080p AV1 | ~0.4 GB | **~23 min** |
| One run @ 720p AV1 (`100024`) | ~0.2 GB | **~11 min** |
| **All 50 record games @ 1080p** | **~20 GB** | **~19 hours** |
| All 50 @ 720p | ~10 GB | ~9 hours |

So the full 50-game pull is an overnight job, not something to fire off casually.
720p is the sensible choice if the purpose is reviewing decisions rather than archiving.

**Download targets, by value:**

| Target | Playlist items | Size |
|---|---|---|
| The record-clinching 50th win | `--playlist-items 74` | ~0.5 GB |
| First game of the record streak | `--playlist-items 25` | ~0.5 GB |
| **The full 50-game world-record streak** | `--playlist-items 25-74` | **~25 GB / ~44 h** |
| The v111 30-run | `25-74` on `BV1HtbU6JErW` p49-78 | ~15 GB |

Videos land in `vods/` (gitignored). Do **not** bulk-pull the whole 7,875-hour archive.

### Just use the wrapper
`fetch-vods.sh` handles the cookie jar, the AV1 fallback chain, and the 412 backoff:

```bash
./fetch-vods.sh                 # landmark runs: the 50th win + streak game 1, 1080p
./fetch-vods.sh 25-74 720       # the whole record streak at 720p (~9 h, ~10 GB)
./fetch-vods.sh 74 1080         # just the record-clinching game
```

It resumes (`--continue`), skips failures (`--ignore-errors`), and retries the
extractor 8 times with increasing backoff. Cookies expire — re-run the refresher in
"Re-running everything" below if it starts 412ing persistently.

## Remaining open question

**Is a new streak running right now?** Still open, and it's a watch-the-room question
rather than a data one. His 2026-08-15 post says he's attempting a **cross-version**
NoSL streak nightly at ~22:00–23:00 CST, 3–4 games a night, after the 猫粮杯 casting.
The v111 collection ends on losses (P79, P82) and the September collection is
mods/challenges, so as of 2026-09-06 he is rebuilding, not mid-record.

Check https://live.bilibili.com/23336970 — `nosl`/`连胜` in the title means a streak
attempt is live; anything else is casual.

## Re-running everything

```bash
cd research/seal
# raw/bili.py           Bilibili API client (WBI signing + buvid fingerprint)
# raw/bvid.py           av→BV id conversion (verified against 6 known pairs)
# raw/catalog_full.json 353 videos / 12,861 episodes
# raw/dynamics.json     721 dynamic posts
```
