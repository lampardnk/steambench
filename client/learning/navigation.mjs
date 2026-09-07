// Read-only graph queries; opaque IDs are never interpreted as labels or coordinates.
export function elements(state) {
  return (state.ui?.elements || []).filter(item => item.visible !== false);
}
export function targetElement(state, id) {
  const matches = elements(state).filter(item => item.id === id);
  if (matches.length !== 1) throw new Error('missing or ambiguous element ID');
  if (matches[0].enabled !== true || matches[0].selectable !== true) throw new Error('element is disabled or not selectable');
  return matches[0];
}
export function navigationPath(state, from, to, maxSteps = 12) {
  targetElement(state, from); targetElement(state, to);
  const known = new Map(elements(state).map(item => [item.id, item]));
  const queue = [[from, []]];
  const visited = new Set([from]);
  while (queue.length) {
    const [id, steps] = queue.shift();
    if (id === to) return steps;
    if (steps.length >= maxSteps) continue;
    for (const direction of ['up', 'down', 'left', 'right']) {
      const next = known.get(id)?.neighbors?.[direction];
      const node = known.get(next);
      if (!node || !node.enabled || !node.selectable || visited.has(next)) continue;
      visited.add(next); queue.push([next, [...steps, { direction, from: id, to: next }]]);
    }
  }
  throw new Error('no verified focus path within 12 steps; refresh or inspect screenshot');
}
