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
/**
 * The direction a person would press: the one that closes most of the gap to
 * the thing they are looking at, on whichever axis the gap is bigger.
 *
 * This is deliberately not a route. It is one press, to be verified by looking
 * at the screen afterwards, which is the only way the fuzzier screens can be
 * crossed at all - the potion strip and the combat rows are walked, not solved.
 */
export function towards(from, to) {
  const centre = (item) => {
    const [x = 0, y = 0, w = 0, h = 0] = item?.bounds || [];
    return [x + w / 2, y + h / 2];
  };
  const [fx, fy] = centre(from);
  const [tx, ty] = centre(to);
  const dx = tx - fx;
  const dy = ty - fy;
  // These screens are stacked in rows - potions, relics, the creatures, the
  // hand - and the rows are wide, so a target several rows down also sits well
  // to one side and a plain dominant-axis test steps sideways along the row it
  // is already in. Sideways has to be clearly the shorter way, or the answer is
  // the row above or below.
  if (Math.abs(dx) > Math.abs(dy) * 1.5) return dx >= 0 ? 'right' : 'left';
  if (Math.abs(dy) > 1) return dy >= 0 ? 'down' : 'up';
  return dx >= 0 ? 'right' : 'left';
}

// Buttons that put focus somewhere fixed instead of acting on what is already
// focused: the panel shortcuts. `a` activates and `y` confirms, so neither can
// be used to travel, and `start` leaves the run for the pause menu.
const PANEL_BUTTONS = ['x', 'back', 'lb', 'rb', 'lt', 'rt'];

const gapX = (a = [], b = []) => {
  const [ax = 0, , aw = 0] = a;
  const [bx = 0, , bw = 0] = b;
  return Math.max(0, Math.max(ax, bx) - Math.min(ax + aw, bx + bw));
};

/**
 * The bound button that lands focus in the target's own row.
 *
 * Some rows are not joined to the rest of the screen by the d-pad at all. From
 * the combat creature row `up` moves nothing and `right` only toggles between
 * the two creatures, so a potion holder three rows above is unreachable by
 * walking, however carefully it is walked - and it is one `x` away. A panel
 * shortcut sits inside the row it opens, so the entrance to a row is the panel
 * button nearest the target along that row. That is also what keeps `back`
 * (the map, same top row, far right) from being mistaken for the potion
 * shortcut sitting against the holders.
 */
export function panelEntrance(state, target, spent = new Set()) {
  const [, ty, , th = 0] = target?.bounds || [];
  if (!Number.isFinite(ty)) return null;
  const found = (state?.ui?.elements || [])
    .filter(item => item.id !== target.id && item.enabled !== false && PANEL_BUTTONS.includes(item.press) && !spent.has(item.press))
    .filter(item => {
      const [, y, , h = 0] = item.bounds || [];
      return Number.isFinite(y) && y < ty + th && y + h > ty;
    })
    .sort((a, b) => gapX(a.bounds, target.bounds) - gapX(b.bounds, target.bounds));
  return found.length ? found[0].press : null;
}

/** The other axis, for when a press along the first one changes nothing. */
export function across(direction) {
  return { left: 'down', right: 'down', up: 'right', down: 'right' }[direction] || 'down';
}

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
