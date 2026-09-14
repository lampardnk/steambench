import fs from 'node:fs';
import path from 'node:path';

const MAX_RUN_BYTES = 2 * 1024 * 1024;
const MAX_EVENT_BYTES = 32 * 1024 * 1024;
const RUN_ROOT = path.join('.local', 'share', 'SlayTheSpire2', 'steam');

const array = value => (Array.isArray(value) ? value : []);
const number = value => (Number.isFinite(Number(value)) ? Number(value) : null);

export function displayId(value) {
  const raw = String(value?.id || value || '').split('.').at(-1) || '';
  const withoutStarterColor = raw.replace(/^(STRIKE|DEFEND)_(?:IRONCLAD|SILENT|DEFECT|NECROBINDER|REGENT)$/, '$1');
  return withoutStarterColor.toLowerCase().split('_').filter(Boolean)
    .map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

function meaningfulId(value) {
  const raw = String(value || '');
  return raw && !/^NONE(?:\.NONE)?$/i.test(raw) ? displayId(raw) : '';
}

function entity(value, kind, floor = null) {
  const id = String(value?.id || value || '');
  if (!id) return null;
  return {
    id,
    name: value?.name || displayId(id),
    kind,
    floor: number(value?.floor_added_to_deck) ?? floor,
    upgraded: Number(value?.current_upgrade_level || 0) > 0 || value?.is_upgraded === true,
    enchantment: value?.enchantment?.id ? displayId(value.enchantment.id) : null,
    type: value?.type || null,
    rarity: value?.rarity || null,
    cost: value?.cost ?? null,
    description: value?.description || null,
  };
}

function entities(values, kind, floor = null) {
  return array(values).map(value => entity(value, kind, floor)).filter(Boolean);
}

function uniqueEntities(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = `${value.id}:${value.upgraded}:${value.enchantment || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function picked(values, kind, floor) {
  return entities(array(values).filter(value => value?.was_picked !== false).map(value => value?.choice || value), kind, floor);
}

function choiceLabels(stats) {
  const labels = [
    ...array(stats.rest_site_choices).map(displayId),
    ...array(stats.event_choices).map(choice => displayId(choice?.title?.key || choice?.title || choice)),
    ...array(stats.ancient_choice).filter(choice => choice?.was_chosen).map(choice => displayId(choice.TextKey || choice?.title?.key)),
    ...array(stats.cards_enchanted).map(change => `Enchanted ${displayId(change?.card)}${change?.enchantment ? ` · ${displayId(change.enchantment)}` : ''}`),
    ...array(stats.cards_transformed).map(change => `Transformed ${displayId(change?.card || change)}`),
  ];
  return labels.filter(Boolean);
}

function nativeFloor(point, floor) {
  const room = array(point?.rooms)[0] || {};
  const stats = array(point?.player_stats)[0] || {};
  const nodeType = String(point?.map_point_type || room.room_type || 'unknown');
  return {
    floor,
    nodeType,
    title: displayId(room.model_id) || displayId(room.room_type) || displayId(nodeType),
    turns: number(room.turns_taken),
    hp: number(stats.current_hp),
    maxHp: number(stats.max_hp),
    gold: number(stats.current_gold),
    damage: number(stats.damage_taken) || 0,
    healed: number(stats.hp_healed) || 0,
    goldGained: number(stats.gold_gained) || 0,
    goldLost: (number(stats.gold_lost) || 0) + (number(stats.gold_stolen) || 0),
    goldSpent: number(stats.gold_spent) || 0,
    cardsGained: entities(stats.cards_gained, 'card', floor),
    cardsRemoved: entities(stats.cards_removed, 'card', floor),
    cardsUpgraded: entities(stats.upgraded_cards, 'card', floor),
    relicsGained: uniqueEntities([
      ...picked(stats.relic_choices, 'relic', floor),
      ...entities(stats.bought_relics, 'relic', floor),
    ]),
    relicsRemoved: entities(stats.relics_removed, 'relic', floor),
    potionsGained: uniqueEntities([
      ...picked(stats.potion_choices, 'potion', floor),
      ...entities(stats.bought_potions, 'potion', floor),
    ]),
    potionsUsed: entities(stats.potion_used, 'potion', floor),
    potionsDiscarded: entities(stats.potion_discarded, 'potion', floor),
    choices: choiceLabels(stats),
  };
}

export function normalizeNativeRun(run) {
  if (!run || typeof run !== 'object' || !Array.isArray(run.map_point_history)) return null;
  const player = array(run.players)[0] || {};
  let floor = 0;
  const acts = run.map_point_history.map((points, index) => ({
    name: displayId(array(run.acts)[index]) || `Act ${index + 1}`,
    floors: array(points).map(point => nativeFloor(point, ++floor)),
  })).filter(act => act.floors.length);
  const last = acts.at(-1)?.floors.at(-1) || null;
  return {
    source: 'native-run',
    result: run.win === true ? 'won' : run.was_abandoned === true ? 'abandoned' : 'lost',
    character: displayId(player.character),
    ascension: number(run.ascension),
    build: run.build_id || null,
    gameMode: displayId(run.game_mode),
    seed: run.seed || null,
    startedAt: number(run.start_time) != null ? Number(run.start_time) * 1000 : null,
    durationSeconds: number(run.run_time),
    hp: last?.hp ?? null,
    maxHp: last?.maxHp ?? null,
    gold: last?.gold ?? null,
    killedBy: meaningfulId(run.killed_by_encounter) || meaningfulId(run.killed_by_event) || null,
    deck: entities(player.deck, 'card'),
    relics: entities(player.relics, 'relic'),
    potions: entities(player.potions, 'potion'),
    badges: array(player.badges).map(badge => ({ name: displayId(badge.id), rarity: badge.rarity || null })),
    acts,
  };
}

function runDirectories(home) {
  const steam = path.join(home, RUN_ROOT);
  if (!fs.existsSync(steam)) return [];
  const directories = [];
  const visit = (directory, depth) => {
    if (depth > 5) return;
    let entries = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const child = path.join(directory, entry.name);
      if (entry.name === 'history' && path.basename(path.dirname(child)) === 'saves') directories.push(child);
      else visit(child, depth + 1);
    }
  };
  visit(steam, 0);
  return directories;
}

export function nativeRunFiles(home) {
  const files = [];
  for (const directory of runDirectories(home)) {
    let entries = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.run')) files.push(path.join(directory, entry.name));
    }
  }
  return files.sort();
}

export function snapshotNativeRuns(home) {
  return new Set(nativeRunFiles(home));
}

function readRun(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size < 2 || stat.size > MAX_RUN_BYTES) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return null; }
}

/** Select the room's newly completed native run without touching host Steam data. */
export function selectNativeRun(home, { baseline = new Set(), startedAt = 0, character = '', ascension = null, result = null } = {}) {
  const wantedCharacter = String(character).toUpperCase().replaceAll(' ', '_');
  const candidates = nativeRunFiles(home).map(file => ({ file, run: readRun(file) })).filter(candidate => candidate.run)
    .filter(({ run }) => Number(run.start_time || 0) * 1000 >= Number(startedAt || 0) - 60000)
    .filter(({ run }) => ascension == null || Number(run.ascension) === Number(ascension))
    .filter(({ run }) => !wantedCharacter || String(run.players?.[0]?.character || '').toUpperCase().endsWith(wantedCharacter));
  candidates.sort((a, b) => {
    const score = candidate => (baseline.has(candidate.file) ? 0 : 8)
      + (candidate.run.was_abandoned === false ? 4 : 0)
      + (result === 'won' && candidate.run.win === true || result === 'lost' && candidate.run.win === false ? 2 : 0);
    return score(b) - score(a) || Number(b.run.start_time || 0) - Number(a.run.start_time || 0);
  });
  return candidates[0] || null;
}

const NODE_PRIORITY = { map: 0, rewards: 1, card_reward: 1, hand_select: 1, card_select: 1, event: 2, treasure: 3, shop: 3, rest_site: 3, monster: 4, elite: 5, boss: 6, game_over: 0 };

function observedTitle(state, type) {
  if (state?.battle?.enemies?.length) return state.battle.enemies.map(enemy => enemy.name).filter(Boolean).join(' + ');
  if (state?.event?.event_name) return state.event.event_name;
  if (state?.event?.name) return state.event.name;
  if (type === 'rest_site') return 'Rest Site';
  if (type === 'shop') return 'Merchant';
  if (type === 'treasure') return 'Treasure';
  return displayId(type) || 'Unknown';
}

function stateEntities(state, field, kind) {
  return entities(field === 'deck' ? state?.deck : state?.player?.[field], kind);
}

function additions(before, after, floor) {
  const counts = new Map();
  for (const item of before) counts.set(`${item.id}:${item.upgraded}`, (counts.get(`${item.id}:${item.upgraded}`) || 0) + 1);
  return after.filter(item => {
    const key = `${item.id}:${item.upgraded}`;
    const count = counts.get(key) || 0;
    if (count) { counts.set(key, count - 1); return false; }
    item.floor = floor;
    return true;
  });
}

/** Build a conservative fallback for archives created before native .run capture. */
export function normalizeRecordedRun(eventsText, room = {}) {
  if (!eventsText || Buffer.byteLength(eventsText, 'utf8') > MAX_EVENT_BYTES) return null;
  const observations = String(eventsText).split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(event => event?.type === 'observation' && Number.isInteger(event?.state?.run?.floor));
  if (!observations.length) return null;
  const points = new Map();
  for (const event of observations) {
    const state = event.state;
    const key = `${state.run.act || 1}:${state.run.floor}`;
    const type = String(state.state_type || 'unknown');
    const point = points.get(key) || { act: state.run.act || 1, floor: state.run.floor, firstAt: event.at, priority: -1, type: 'unknown', title: 'Unknown', maxTurns: null };
    point.lastAt = event.at;
    point.last = state;
    const priority = NODE_PRIORITY[type] ?? 1;
    if (priority > point.priority) {
      point.priority = priority;
      point.type = type === 'event' ? (state.event?.is_ancient ? 'ancient' : 'unknown') : type;
      point.title = observedTitle(state, point.type);
    }
    if (state.battle?.round != null) point.maxTurns = Math.max(point.maxTurns || 0, Number(state.battle.round));
    points.set(key, point);
  }
  const ordered = [...points.values()].sort((a, b) => a.act - b.act || a.floor - b.floor);
  let previous = null;
  for (const point of ordered) {
    const state = point.last;
    const deck = stateEntities(state, 'deck', 'card');
    const relics = stateEntities(state, 'relics', 'relic');
    const potions = stateEntities(state, 'potions', 'potion');
    point.view = {
      floor: point.floor, nodeType: point.type, title: point.title, turns: point.maxTurns,
      hp: number(state.player?.hp), maxHp: number(state.player?.max_hp), gold: number(state.player?.gold),
      damage: previous && number(previous.player?.hp) != null && number(state.player?.hp) != null ? Math.max(0, Number(previous.player.hp) - Number(state.player.hp)) : 0,
      healed: 0, goldGained: previous && number(previous.player?.gold) != null && number(state.player?.gold) != null ? Math.max(0, Number(state.player.gold) - Number(previous.player.gold)) : 0,
      goldLost: 0, goldSpent: 0,
      cardsGained: previous ? additions(stateEntities(previous, 'deck', 'card'), deck, point.floor) : [], cardsRemoved: [], cardsUpgraded: [],
      relicsGained: previous ? additions(stateEntities(previous, 'relics', 'relic'), relics, point.floor) : [], relicsRemoved: [],
      potionsGained: previous ? additions(stateEntities(previous, 'potions', 'potion'), potions, point.floor) : [], potionsUsed: [], potionsDiscarded: [], choices: [],
    };
    previous = state;
  }
  const final = ordered.at(-1)?.last || {};
  const first = observations[0];
  const last = observations.at(-1);
  const acts = [...new Set(ordered.map(point => point.act))].map(act => ({ name: `Act ${act}`, floors: ordered.filter(point => point.act === act).map(point => point.view) }));
  return {
    source: 'sensor-history', result: room?.finish?.result || (final.game_over?.win ? 'won' : 'lost'),
    character: final.player?.character || room?.setup?.task?.character || 'Unknown', ascension: number(final.run?.ascension ?? room?.setup?.task?.ascension),
    build: final.sensor_version ? `sensor v${final.sensor_version}` : null, gameMode: 'Standard', seed: null,
    startedAt: first?.at || room?.createdAt || null, durationSeconds: first?.at && last?.at ? Math.max(0, Math.round((last.at - first.at) / 1000)) : null,
    hp: number(final.player?.hp), maxHp: number(final.player?.max_hp), gold: number(final.player?.gold), killedBy: null,
    deck: stateEntities(final, 'deck', 'card'), relics: stateEntities(final, 'relics', 'relic'), potions: stateEntities(final, 'potions', 'potion'), badges: [], acts,
  };
}

export function historyRunView(nativeRun, eventsText, room) {
  return normalizeNativeRun(nativeRun) || normalizeRecordedRun(eventsText, room);
}
