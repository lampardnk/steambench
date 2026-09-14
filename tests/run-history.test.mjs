import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  historyRunView,
  normalizeNativeRun,
  normalizeRecordedRun,
  selectNativeRun,
  snapshotNativeRuns,
} from '../server/lib/run-history.mjs'

function nativeRun(overrides = {}) {
  return {
    schema_version: 10,
    acts: ['ACT.UNDERDOCKS'],
    ascension: 1,
    build_id: 'v0.111.0',
    game_mode: 'standard',
    seed: 'FIXTURE',
    start_time: 200,
    run_time: 90,
    win: false,
    was_abandoned: false,
    players: [
      {
        character: 'CHARACTER.IRONCLAD',
        deck: [{ id: 'CARD.STRIKE_IRONCLAD' }, { id: 'CARD.POMMEL_STRIKE', current_upgrade_level: 1 }],
        relics: [{ id: 'RELIC.BURNING_BLOOD', floor_added_to_deck: 1 }],
        potions: [],
      },
    ],
    map_point_history: [
      [
        {
          map_point_type: 'monster',
          rooms: [{ room_type: 'monster', model_id: 'ENCOUNTER.CORPSE_SLUGS_WEAK', turns_taken: 4 }],
          player_stats: [
            {
              current_hp: 54,
              max_hp: 80,
              current_gold: 112,
              damage_taken: 12,
              hp_healed: 6,
              gold_gained: 13,
              cards_gained: [{ id: 'CARD.POMMEL_STRIKE' }],
              relic_choices: [{ choice: 'RELIC.BAG_OF_PREPARATION', was_picked: true }],
            },
          ],
        },
      ],
    ],
    ...overrides,
  }
}

test('native .run normalization preserves the game history fields used by the view', () => {
  const view = normalizeNativeRun(nativeRun())
  assert.equal(view.source, 'native-run')
  assert.equal(view.character, 'Ironclad')
  assert.equal(view.deck[0].name, 'Strike')
  assert.equal(view.deck[1].upgraded, true)
  const floor = view.acts[0].floors[0]
  assert.deepEqual(
    {
      floor: floor.floor,
      nodeType: floor.nodeType,
      title: floor.title,
      turns: floor.turns,
      hp: floor.hp,
      maxHp: floor.maxHp,
      gold: floor.gold,
    },
    { floor: 1, nodeType: 'monster', title: 'Corpse Slugs Weak', turns: 4, hp: 54, maxHp: 80, gold: 112 },
  )
  assert.equal(view.acts[0].floors[0].cardsGained[0].name, 'Pommel Strike')
  assert.equal(view.acts[0].floors[0].relicsGained[0].name, 'Bag Of Preparation')
})

test('archive selection prefers a new matching non-abandoned run over synchronized history', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'steambench-native-run-'))
  const history = path.join(home, '.local/share/SlayTheSpire2/steam/1/modded/profile1/saves/history')
  fs.mkdirSync(history, { recursive: true })
  fs.writeFileSync(path.join(history, '100.run'), JSON.stringify(nativeRun({ start_time: 100, was_abandoned: false })))
  const baseline = snapshotNativeRuns(home)
  fs.writeFileSync(path.join(history, '190.run'), JSON.stringify(nativeRun({ start_time: 190, was_abandoned: true })))
  fs.writeFileSync(path.join(history, '200.run'), JSON.stringify(nativeRun({ start_time: 200, was_abandoned: false })))
  const selected = selectNativeRun(home, {
    baseline,
    startedAt: 180000,
    character: 'Ironclad',
    ascension: 1,
    result: 'lost',
  })
  assert.equal(path.basename(selected.file), '200.run')
})

test('older archives get a conservative view from verified observation history', () => {
  const events = [
    {
      at: 1000,
      type: 'observation',
      state: {
        state_type: 'monster',
        run: { act: 1, floor: 2, ascension: 1 },
        player: { character: 'The Ironclad', hp: 70, max_hp: 80, gold: 99, relics: [], potions: [] },
        deck: [{ id: 'STRIKE_IRONCLAD', name: 'Strike' }],
        battle: { round: 1, enemies: [{ name: 'Wriggler' }] },
      },
    },
    {
      at: 3000,
      type: 'observation',
      state: {
        state_type: 'rewards',
        run: { act: 1, floor: 2, ascension: 1 },
        player: { character: 'The Ironclad', hp: 65, max_hp: 80, gold: 111, relics: [], potions: [] },
        deck: [
          { id: 'STRIKE_IRONCLAD', name: 'Strike' },
          { id: 'POMMEL_STRIKE', name: 'Pommel Strike' },
        ],
      },
    },
  ]
    .map((row) => JSON.stringify(row))
    .join('\n')
  const view = normalizeRecordedRun(events, { finish: { result: 'lost' } })
  assert.equal(view.source, 'sensor-history')
  assert.equal(view.acts[0].floors[0].title, 'Wriggler')
  assert.equal(view.deck.length, 2)
  assert.equal(historyRunView(nativeRun(), events, {}).source, 'native-run')
})

test('the run view links to the requested wiki and contains no similar-runs section', () => {
  const source = fs.readFileSync(new URL('../components/run-history.tsx', import.meta.url), 'utf8')
  assert.match(source, /https:\/\/slaythespire\.wiki\.gg\/wiki\/Slay_the_Spire_2:Main/)
  assert.doesNotMatch(source, /href=.*spire-codex\.com/i)
  assert.doesNotMatch(source, /similar winning runs/i)
  assert.match(source, /group-hover(?:\/\w+)?:(?:visible|block)/)
  assert.match(source, /cards-full\/stable/)
  assert.match(source, /ui\/run_history\//)
  assert.match(source, /ui\/top_bar\//)
  assert.match(source, /ui\/run_history_card/)
  assert.match(source, /characters\/character_icon_/)
  assert.match(source, /group-focus-within/)
})
