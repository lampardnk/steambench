/**
 * The team that plays the run, and the lane each member talks in.
 *
 * One agent reading everything was the problem: a combat decision arrived with
 * the map graph, the objective ladder and a large prompt covering decisions
 * that were not part of the fight, and the model
 * spent its output budget reasoning across all of it before emitting any JSON.
 * Splitting the work splits the context with it. Each role below sees only what
 * its own job rests on, and nothing else reaches it.
 *
 * These are not separate processes. Every model call already spawns its own
 * stateless `pi`, so a "subagent" here is a scoped context, a system prompt and
 * a transcript lane - which is exactly the part that was flooding. A persistent
 * per-fight session would put the flooding back.
 */
export const ROLES = {
  room: {
    label: 'Room',
    prompt: null,
    blurb: 'The operator, the runtime, and the run itself. Not a model.',
  },
  strategist: {
    label: 'Strategist',
    prompt: 'strategist.txt',
    blurb: 'Routes the map, drafts the deck, works the shops and events. Never sees a fight.',
  },
  combat: {
    label: 'Combat',
    prompt: 'combat.txt',
    blurb: 'One encounter, start to finish. Never sees the map.',
  },
  curriculum: { label: 'Curriculum', prompt: 'curriculum.txt', blurb: 'Chooses the next objective.' },
  critic: { label: 'Critic', prompt: 'critic.txt', blurb: 'Decides whether an objective was met.' },
};

/** Stable lane id for the roles that exist for the whole room. */
export const LANE = { room: 'room', strategist: 'strategist', curriculum: 'curriculum', critic: 'critic' };

/**
 * Who is speaking, so the dashboard can file it. Every event a member emits
 * carries its lane id; the roster itself is published whenever it changes, so
 * the client can render the list without inferring it from message traffic.
 */
export class Roster {
  constructor({ emit, record = () => {} }) {
    this.emit = emit;
    this.record = record;
    this.members = new Map();
    for (const id of Object.values(LANE)) this.open(id, { role: id, title: ROLES[id].blurb, publish: false });
    this.publish();
  }

  open(id, { role, title = null, parent = null, publish = true } = {}) {
    const existing = this.members.get(id);
    if (existing && existing.status === 'open') return existing;
    const member = { id, role, label: ROLES[role]?.label || role, title, parent, status: 'open', openedAt: Date.now(), closedAt: null, decisions: 0, outcome: null, summary: null };
    this.members.set(id, member);
    if (publish) { this.record({ type: 'agent_open', agent: id, role, title, parent }); this.publish(); }
    return member;
  }

  close(id, { outcome = null, summary = null } = {}) {
    const member = this.members.get(id);
    if (!member || member.status === 'closed') return member || null;
    Object.assign(member, { status: 'closed', closedAt: Date.now(), outcome, summary });
    this.record({ type: 'agent_close', agent: id, role: member.role, outcome, summary });
    this.publish();
    return member;
  }

  /** Persistent lanes are always listed; finished encounters stay as history. */
  get list() {
    return [...this.members.values()].map(member => ({ ...member }));
  }

  count(id) {
    const member = this.members.get(id);
    if (member) member.decisions++;
  }

  publish() {
    this.emit({ type: 'steambench_agents', agents: this.list });
  }

  /** Emit one event in a member's lane. */
  as(id, event) {
    this.emit({ ...event, agent: id });
  }
}

/**
 * A lane id for one encounter. The ordinal comes first so the lanes sort in the
 * order they were fought, and the act and floor make the lane readable in the
 * dashboard - which is what it is for. A room that replays a floor after a
 * reload gets a distinct lane rather than writing over the earlier fight.
 */
export function encounterLane(state, ordinal) {
  return `combat-${String(ordinal).padStart(3, '0')}-a${state?.run?.act ?? '?'}f${state?.run?.floor ?? '?'}`;
}

export function encounterTitle(state, kind) {
  const names = [...new Set((state?.battle?.enemies || []).map(enemy => enemy.name).filter(Boolean))];
  const who = names.length ? names.join(' + ') : 'unknown enemies';
  return `${kind} · act ${state?.run?.act ?? '?'} floor ${state?.run?.floor ?? '?'} · ${who}`;
}
