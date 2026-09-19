import { semanticIdentity } from './state.mjs';

/**
 * What the System One model is asked on each screen, and what is done with the
 * answer.
 *
 * Two modes, and which one a screen gets was measured, not chosen:
 *
 * - `gate` acts on the model's pick when confidence clears the bar, and hands
 *   the screen to the planner when it does not. Navigation earns this: on the
 *   run's 13 real multi-option map nodes a flat Choice agreed with the
 *   strategist 11 times, and confidence tracked agreement in the right
 *   direction (6/6 above 0.5, 4/7 below).
 *
 * - `annotate` never acts. The reading goes into the planner's context as
 *   evidence and the planner still decides. Deck-building gets this because
 *   its confidence runs backwards: on 15 card rewards the cascade agreed 6/12
 *   when confident and 3/3 when not. A gate there would act on exactly the
 *   picks it got wrong.
 *
 * The thresholds below are provisional - 13 and 15 decisions is enough to
 * choose a mode, not enough to fit a number. Every consultation is recorded
 * with its confidence and whether it escalated, so the next run refits them
 * from hundreds of samples instead of tens.
 */

const deckSummary = (state) => {
  const counts = new Map();
  for (const card of state.deck || []) {
    const key = `${card.name}${card.is_upgraded ? '+' : ''}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].map(([name, count]) => (count > 1 ? `${name} x${count}` : name));
};

/**
 * The run, as the decision needs to see it.
 *
 * Rich and narrow at the same time: relics carry their rules text because a
 * relic's name does not say what it does, while the draw and discard piles are
 * absent because no screen-level decision turns on them. Unrelated detail is
 * not free - it measurably costs accuracy.
 */
const situationOf = (state) => ({
  hp: state.player?.hp, max_hp: state.player?.max_hp, gold: state.player?.gold,
  character: state.player?.character, act: state.run?.act, floor: state.run?.floor,
  ascension: state.run?.ascension,
  relics: (state.player?.relics || []).map(relic => `${relic.name}: ${relic.description}`),
  potions: (state.player?.potions || []).filter(potion => potion.name).map(potion => potion.name),
  deck: deckSummary(state), deck_size: (state.deck || []).length,
});

const card = (item) => ({ name: item.name, cost: item.cost, type: item.type, rarity: item.rarity, upgraded: item.is_upgraded, text: item.description });

/** The aspects that decide a draft. Measured at 9/15 against the strategist. */
const CARD_ASPECTS = Object.freeze({
  redundant: 'The deck already contains several cards that do essentially what this card does, so adding it would change little about how the deck plays',
  ceiling: 'This card meaningfully raises what the deck can do on its strongest turns',
  survival: 'This card helps the player survive incoming damage over a long fight',
  dead: 'This card does nothing useful unless the deck has a combination piece it currently lacks',
  affordable: 'This card can comfortably be played alongside the deck\'s other cards on a normal turn, given the energy available',
  scaling: 'This card gets stronger as a fight goes on, rather than being a one-off effect',
  fixes_gap: 'This card addresses something this particular deck currently cannot do at all',
});

const SHOP_ASPECTS = Object.freeze({
  affordable: 'The player can pay for this and still have gold left for something the run is likely to need later',
  redundant: 'The deck or relic set already covers what this item provides',
  fixes_gap: 'This item addresses something this run currently cannot do at all',
  lasting: 'The benefit of this item lasts for the rest of the run rather than a single fight',
});

export const SURFACES = Object.freeze({
  map: {
    mode: 'gate',
    // 11/13 agreement; confidence separated cleanly at 0.5 on the sample.
    threshold: 0.5,
    options: (state) => state.map?.next_options || [],
    id: (option) => semanticIdentity('map', option),
    name: (option) => `${option.type} at column ${option.col}, row ${option.row}`,
    describe: (option) => `a ${option.type} node at column ${option.col}, row ${option.row}`,
    instructions: 'Which node should the player travel to next, playing to win the run?',
    state: (state) => ({ ...situationOf(state), current_position: state.map?.current_position, next_options: state.map.next_options }),
    action: (id) => ({ type: 'choose_map_node', node: id }),
  },
  // `rewards` is deliberately absent. Replayed over the run the classifier
  // agreed with the strategist on 11 of 27 reward screens, and on the 2 where
  // it was confident enough to act it was wrong both times - the one surface
  // measured where the gate fired and did not earn it. Claim order is also the
  // decision least worth buying: the player ends up taking everything anyway.
  treasure: {
    mode: 'gate',
    threshold: 0.5,
    options: (state) => state.treasure?.relics || [],
    id: (option) => semanticIdentity('relic', option),
    name: (option) => option.name || 'relic',
    describe: (option) => `${option.name}: ${option.description}`.slice(0, 200),
    instructions: 'Which relic should the player take, playing to win the run?',
    state: (state) => ({ ...situationOf(state), offered_relics: (state.treasure.relics || []).map(relic => ({ name: relic.name, text: relic.description, rarity: relic.rarity })) }),
    action: (id) => ({ type: 'claim_treasure_relic', relic: id }),
  },
  rest_site: {
    mode: 'gate',
    // Resting is a real commitment - the alternative is always declining - so
    // this sits higher than navigation and escalates readily.
    threshold: 0.7,
    options: (state) => (state.rest_site?.options || []).filter(option => option.is_enabled !== false),
    id: (option) => semanticIdentity('rest', option),
    name: (option) => option.name || option.id || 'option',
    describe: (option) => `${option.name || option.id}: ${option.description || ''}`.slice(0, 200),
    instructions: 'How should the player spend this rest, playing to win the run?',
    state: (state) => ({ ...situationOf(state), rest_options: state.rest_site.options }),
    action: (id) => ({ type: 'choose_rest_option', option: id }),
  },
  card_reward: {
    mode: 'annotate',
    aspects: CARD_ASPECTS,
    options: (state) => state.card_reward?.cards || [],
    id: (option) => semanticIdentity('card_reward', option),
    name: (option) => option.name,
    describe: (option) => `${option.name} — ${option.description}`.slice(0, 200),
    instructions: 'Which of these cards should be added to the deck, playing to win the run?',
    state: (state) => ({ ...situationOf(state), offered_cards: (state.card_reward.cards || []).map(card) }),
    guidance: 'Each assessment was produced by evaluating that one card against this exact deck. Prefer the card that closes a real gap or raises the ceiling; avoid cards assessed as redundant or dead.',
  },
  shop: {
    mode: 'annotate',
    aspects: SHOP_ASPECTS,
    options: (state) => (state.shop?.items || []).filter(item => item.is_stocked !== false),
    id: (option) => semanticIdentity('shop_item', option),
    name: (option) => option.name || 'item',
    describe: (option) => `${option.name} (${option.price} gold): ${option.description || ''}`.slice(0, 200),
    instructions: 'Which item, if any, is the best use of this run\'s gold right now?',
    state: (state) => ({ ...situationOf(state), shop_items: state.shop.items }),
    guidance: 'Each assessment was produced by evaluating that one item against this exact run. Gold not spent is not wasted; prefer an item that closes a real gap over one that is merely affordable.',
  },
});

/** The surface definition for a screen, or null when it has none. */
export function surfaceFor(state) {
  const definition = SURFACES[String(state?.state_type || '').toLowerCase()];
  if (!definition) return null;
  // Two or more real options, or there is nothing to choose between.
  const options = definition.options(state) || [];
  return options.length >= 2 && options.every(option => definition.id(option) != null) ? { ...definition, resolved: options } : null;
}
