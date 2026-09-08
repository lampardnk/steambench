// Read-only graph queries; opaque IDs are never interpreted as labels or coordinates.
// Kept free of imports: this module is part of the policy digest and is exercised
// by tests that construct a bare state object, with no profile or environment.
const DIRECTIONS = ['up', 'down', 'left', 'right'];

/**
 * Godot 4.5 resolves focus with get_focus_mode_with_override, and only All is
 * reachable with a d-pad; Click is mouse-only. Treating Click as navigable
 * filled this graph with tooltip labels and top-bar readouts, so a route could
 * be planned through a control the pad can never land on. Sensors older than v5
 * do not report the effective mode, so selectable is still honoured when
 * focus_mode is absent. Whatever currently holds focus is a target by
 * definition, however it is configured: a screen that grabs focus onto a Click
 * control must not become unaddressable.
 */
function navigable(item, focusedId) {
  if (item.enabled !== true) return false;
  if (item.id === focusedId) return true;
  if (item.focus_mode === undefined) return item.selectable === true;
  return item.focus_mode === 'all';
}

export function elements(state) {
  return (state.ui?.elements || []).filter(item => item.visible !== false);
}

/** The elements a directional press can actually land on. */
export function focusTargets(state) {
  const focused = state.ui?.focused_element;
  return elements(state).filter(item => navigable(item, focused));
}

export function targetElement(state, id) {
  const matches = elements(state).filter(item => item.id === id);
  if (matches.length !== 1) throw new Error(`no element with ID ${id} on this screen`);
  if (!navigable(matches[0], state.ui?.focused_element)) throw new Error('element is disabled or not selectable');
  return matches[0];
}

/**
 * A control addressed by its bound button rather than by focus. It does not
 * have to be focusable at all - that is the point of a hotkey - so this is
 * deliberately laxer than targetElement.
 */
export function pressableElement(state, id) {
  const matches = elements(state).filter(item => item.id === id);
  if (matches.length !== 1) throw new Error(`no element with ID ${id} on this screen`);
  if (matches[0].enabled !== true) throw new Error('element is disabled');
  return matches[0];
}

/**
 * Shortest route between two elements over the focus graph the game actually
 * wired. There is no geometric fallback on purpose. The screens that look like
 * they need one are the ones that least tolerate it: NCardGrid and
 * NCardRewardSelectionScreen point a card row's up and down neighbours back at
 * the card itself and wrap left and right within the row, so the row is a
 * closed loop and Skip genuinely has no route from it. Inferring an edge there
 * from the on-screen geometry produces a plausible route whose presses do
 * nothing. "No route" is the true answer, and the caller should look for a
 * bound button instead.
 *
 * avoid holds `id|direction` keys for edges a previous attempt pressed and did
 * not land where predicted, so a retry explores a different route rather than
 * repeating the press that just failed.
 */
export function navigationPath(state, from, to, maxSteps = 12, avoid = new Set()) {
  targetElement(state, from); targetElement(state, to);
  const known = new Map(focusTargets(state).map(item => [item.id, item]));
  const queue = [[from, []]];
  const visited = new Set([from]);
  while (queue.length) {
    const [id, steps] = queue.shift();
    if (id === to) return steps;
    if (steps.length >= maxSteps) continue;
    for (const direction of DIRECTIONS) {
      const next = known.get(id)?.neighbors?.[direction];
      if (!next || next === id || !known.has(next) || visited.has(next) || avoid.has(`${id}|${direction}`)) continue;
      visited.add(next);
      queue.push([next, [...steps, { direction, from: id, to: next }]]);
    }
  }
  throw new Error(`no verified focus path within ${maxSteps} steps; if the target names a bound button, press that instead`);
}
