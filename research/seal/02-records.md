# 02 — Record ledger

## TL;DR — the correction to your brief

Your brief said **38 wins and counting**, prior WR **24**.

- The prior WR of **24** is correct — held by **navagreed** (rotating NoSL, STS2).
- The **38 was a mid-streak checkpoint, not the final number.**
  The streak ran to **50 consecutive wins** and then ended.
- He published the whole thing himself under the title
  **《杀戮尖塔2—创造历史50连！110版本nosl点播合集》**
  ("Making history, 50 in a row — v110 NoSL requested-runs collection") → `BV1SxGM66ESZ`.
- **He confirmed it in his own words on 2026-08-15**:
  > 成功50连胜啦[星星眼]也顺手应该是拿下了第一个全职业nosl10连…会继续尝试挑战一下跨版本Nosl连胜

  *"Got 50 wins in a row! And along the way I think I also took the first
  all-character NoSL 10-streak… I'll keep trying to challenge the cross-version
  NoSL streak."* — **so the record date is 2026-08-15.** See `07-timeline.md`.

So the framing "38 and counting, chasing 24" describes a real moment that has since
been overtaken. The headline is **50, from a prior record of 24**.

---

## How I verified it (methodology)

This is the part worth trusting, because it doesn't rely on forum hearsay.

He uploads **every** run, win or loss, as a numbered part (P1, P2, …) inside a
per-patch collection, and he marks losses in the episode title with **豹毙**
("死" / died) or **似** (slang for 死). So the streak structure is recoverable
directly from the episode list.

I pulled the complete episode list from Bilibili's `medialist` API
(`raw/catalog_full.json`, 12,861 episodes) and computed unbroken win-runs.

**Result for `BV1SxGM66ESZ` (v110):** 74 games, 5 losses at P1, P14, P19, P20, P24 →
**69 wins / 74 games**, longest unbroken run = **50** (P25 → P74).

**Three independent cross-checks, all exact:**

| Checkpoint | Community-reported | My reconstruction | Match |
|---|---|---|---|
| At streak = 24 | 43 wins / 48 games | 19 + 24 = **43 / 48** | ✅ exact |
| At streak = 34 | 53 wins / 58 games | 19 + 34 = **53 / 58** | ✅ exact |
| Final collection | — | 69 / 74 = full 74-episode collection | ✅ exact |
| Longest run | "创造历史50连" (his own title) | **50** computed independently | ✅ exact |

Two forum snapshots taken at different times, his own video title, and the raw
episode count all agree. **[VERIFIED]**

### It really is "rotating"

The 50-run is a **strict 5-character rotation**, not just mixed play. Sequence:

```
机 战 猎 储 骨  机 战 猎 储 骨  机 战 猎 储 骨  ...  (×10 cycles = 50)
Defect→Warrior→Hunter→Prince→Necrobinder, repeating
```

The v111 30-run is even cleaner — 6 perfect cycles of 猎→储→骨→机→战.
Character counts in the 50-run: 机 10, 战 10, 储 10, 骨 10, and the Hunter slot 10.

**On the 猎/贼 labelling** — worth stating because it looks like an inconsistency and
isn't: he writes the Hunter/Silent as **猎** or **贼** interchangeably depending on the
build (毒贼 = poison build, 刀贼 = knife build, 猎 = generic). Proof: his *Hunter-only*
collection `BV1k5gm6eEQ1` ("nosl**猎**点播合集") contains both — "28卡计妥触媒毒贼" sits
right beside "37卡苦无乌龟猎". So slot 3 of the rotation is one character throughout,
and the rotation is genuinely strict: **5 characters × 10 cycles = 50**. **[VERIFIED]**

---

## STS2 record ledger

| # | Achievement | Value | Evidence | Status |
|---|---|---|---|---|
| 1 | **Rotating NoSL win streak (A10)** | **50** | `BV1SxGM66ESZ` P25–P74, patch v110 | **[VERIFIED]** |
| 2 | Session record around that streak | 69W / 74 | computed, `data/nosl_streaks.csv` | **[VERIFIED]** |
| 3 | Previous rotating NoSL WR | 24, **navagreed** | Baidu Tieba / 233 reposts | [COMMUNITY] |
| 3b | "First all-character NoSL 10-streak" | 10 w/ every class | his own post 2026-08-15 (hedged "应该是") | [SELF-REPORTED] |
| 4 | Best rotating run on v111 | 30 | `BV1HtbU6JErW` P49–P78 | **[VERIFIED]** |
| 5 | Hunter-only NoSL best (v109) | 13 | `BV1k5gm6eEQ1` P19–P31 | **[VERIFIED]** |
| 6 | v108 NoSL best | 7 | `BV1WcMK6LEGu` P6–P12 | **[VERIFIED]** |
| 7 | 储君 (Prince) 100-streak run | 114 eps, avg 43.6 min, avg deck 25 | `BV12TJT6JEdN` | **[VERIFIED]** |
| 8 | Necrobinder 100-streak run | 71 games, avg 43 min, avg deck 27 | `BV1cdEM6kE3r` | **[VERIFIED]** |
| 9 | Defect 100-streak run | 64 games, avg 36.4 min, avg deck 27.2 | `BV1HQVr6dEK2` | **[VERIFIED]** |
| 10 | Warrior 100-streak run | 33 games (v106), avg 33 min, avg deck 24.9 | `BV1SAVe6LEuS` | **[VERIFIED]** |
| 11 | Hunter 100-streak run | avg 44 min, avg deck 32.9 | `BV1EuGh6DEKT` | **[VERIFIED]** |
| 12 | Fastest 储君 A10 speedrun | **11:52** | `BV1gpcSzyE5Y` | **[VERIFIED]** (his claim "目前最快") |
| 13 | 10-min Necrobinder speedrun | ~10 min | `BV1yjwwzTEfs` | **[VERIFIED]** |

**On the "40 minutes per game" claim in your brief**: his own published per-collection
stats confirm it and are more precise — Defect **36.4 min**, Warrior **33 min**,
Prince **43.6 min**, Necrobinder **43 min**, Hunter **44 min**. Average deck sizes
25–33 cards. These are his numbers, printed in his own video descriptions.

---

## STS1 legacy records

| Achievement | Date | Evidence | Status |
|---|---|---|---|
| Watcher 100-streak heart-kill | 2021-11-23 | `BV14q4y167gM` (42 eps, 44 h) | **[VERIFIED]** |
| Ironclad 100-streak heart-kill | 2021-11-25 | `BV1ai4y1o7z5` (62 eps, 68 h) | **[VERIFIED]** |
| **All-4-character 100-streaks completed** | 2022-07-25 | `BV1UV4y1775Y` "四职业百连达成" (99 eps, 76 h) | **[VERIFIED]** |
| Ironclad 200-win streak | 2023-05-01 | `BV1Do4y1t7iA` | **[VERIFIED]** |
| Defect 198→200 streak | 2025-05-21 | `BV1xFJqz2E1a` | **[VERIFIED]** |
| **Defect 300-win streak** | 2025-08-23 | `BV1XjeYzJEeS` + run-up `BV1TVbjzSErB` | **[VERIFIED]** |
| Tournament win ("夺冠") | ~Aug 2021 | referenced in Sept 2021 VOD desc | [COMMUNITY] |
| "A20 heart-kill 546-win streak" | — | single Zhihu answer only | **[UNVERIFIED]** — do not repeat |

### On the 546 figure
A Zhihu answer credits him with "a20碎心546连胜". I could **not** corroborate it
anywhere in his own 353-video archive or his 721 dynamic posts, both of which document
100/200/300 milestones carefully.

**Probable origin, now that I have his feed**: on **2026-06-25** he posted that he had
finished an **all-character _SL_ 100-streak challenge** (May 23 → Jun 24) and that the
streak save stood at **500-plus games with only two deaths** — in *STS2*, with
save-loading allowed. That is very likely the number that mutated into "546 A20 NoSL".
Treat 546 as **[UNVERIFIED]**; the **300** (Defect, 2025-08) remains the highest
NoSL-context streak he has himself published.

---

## Context: what the NoSL record landscape looks like

I got through NGA's anti-bot guard and read the thread directly. Important: it is a
snapshot of **STS1 A20 heart-kill NoSL** records — the original poster confirms this
in reply #3 (`是，进阶20碎心nosl`). Posted 2025-11-02 — **[COMMUNITY]**:

| Character | Holder | Streak |
|---|---|---|
| 铁甲战士 Ironclad | XecnaR | 24 |
| 静默猎手 Silent | XecnaR | 27 |
| 故障机器人 Defect | XecnaR | 29 |
| 观者 Watcher | OnePunMan_ | 57 → **64** (updated by OP 2025-11-12) |
| **轮换 Rotating** | **XecnaR** | **26** |

**There is no formal ratification body.** I read all 8 posts in that NGA thread: it
contains **no mention of 白夕, STS2, or the 50** — it has not been updated for STS2 at
all. So the 50 is documented by his own published VODs and community consensus, not by
any leaderboard. Nothing exists for STS NoSL streaks equivalent to speedrun.com.

That table is still the useful baseline: elite rotating NoSL in STS1 sat around 24–26, and
STS2's rotating record was navagreed's 24. **A 50 is roughly double the historical
ceiling for the category**, which is why the Chinese forums reacted the way they did
("Nosl小团体被摘桃子" — the NoSL in-group got their peach picked).

Relevant non-Chinese names in the same space: **Xecnar**, **OnePunMan_**,
**Lifecoach** (52-streak Watcher WR, mirrored on Bilibili), **navagreed**.

---

## Integrity notes (you asked about non-serious runs)

A few things that speak *for* the legitimacy of the record, and one caveat:

- **He publishes his losses.** Every collection contains the 豹毙 games, including
  8-minute Act-1 deaths. He is not filtering the record.
- **Self-policing on NoSL rules**: on 2026-07-10 a danmaku overlay hid a boss intent,
  he misclicked, used a save-load, and **declared the run void (流局)** rather than
  counting it. [COMMUNITY, via 233乐园 repost of the VOD]
- **Caveat — separate the categories.** His archive mixes serious NoSL streak runs
  with a lot of deliberately non-serious content: mod runs (崩坠mod, 轮椅尖塔mod,
  观者mod), cosplay-gimmick runs (里店长cos骨, 里以撒cos战), challenge runs
  (只靠发现印牌 = "only cards from Discovery"), date-seed 算命 runs, and co-op.
  **The September 2026 VOD collection (`BV1kPtE68E4L`) is almost entirely this kind
  of content — it is not streak material.** Don't read streak claims off it.
  The streak runs live only in the per-patch `nosl合集` collections.
