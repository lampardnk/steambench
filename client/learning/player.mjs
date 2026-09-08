import { EncounterScratchpad } from './encounter.mjs';
import { Act1Timer } from './pacing.mjs';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import gateway from '../gateway_client.js';
import { Planner } from './planner.mjs';
import { Executor, learnedFiles, SCRATCHPAD_NOTE, REFLECTION_HEADER } from './executor.mjs';
import { DIRECTIONS, VERSION, SENSOR_VERSION, compactState, digest, plannerGuidance, plannerResult, transientUpstream, stateDiff, stateId, validatePlan } from './state.mjs';
import { LANE, ROLES, Roster, encounterLane, encounterTitle } from './agents.mjs';
import { Actuator } from './actuator.mjs';
import { briefing, combatContext, encounterKind, splitNotes, strategistContext } from './context.mjs';
import { ObservationCatalog, acceptedLessons, compatibility } from './memory.mjs';
import { Curriculum } from './curriculum.mjs';
import { controlManual, indexNotes, retrieve } from './retrieval.mjs';

// Actions that read or write knowledge and never touch the pad. A decision made
// only of these cannot change the game, which matters twice below: an unchanged
// observation after one proves nothing about being stuck, and a run of them is
// note-taking crowding out play.
const BOOKKEEPING = new Set(['learn', 'recall', 'research', 'lookup']);
const bookkeepingOnly = (plan) => plan.actions.every(action => BOOKKEEPING.has(action.type));
const TRANSIENT_BACKOFF_MS = [2000, 5000, 12000, 30000];

// One reversible directional press, sent to find out where focus actually is.
// It answers a question, so a run of them means the question is not the problem.
const probeOnly = (plan) => {
  const steps = plan.actions.filter(action => !BOOKKEEPING.has(action.type));
  return steps.length === 1 && steps[0].type === 'input' && steps[0].buttons?.length === 1
    && DIRECTIONS.includes(steps[0].buttons[0]) && !steps[0].expect;
};
import { PROFILE } from './profile.mjs';
import { learningDelta, saveIncident } from './incidents.mjs';

const directory = process.env.STEAMBENCH_LEARNING_SCRATCHPAD || '/workspace/skills/sts2/scratchpad';
// The skill tree outlives the room through the server's git library; scratchpad/ does not.
const skillDir = path.dirname(directory);
fs.mkdirSync(directory, { recursive: true });
let checkpoint = null;
try { checkpoint = JSON.parse(fs.readFileSync(path.join(directory, 'checkpoint.json'), 'utf8')); } catch { }
if (checkpoint?.version !== VERSION) checkpoint = null;
const sessionId = randomUUID().slice(0, 8);
const emit = event => process.stdout.write(JSON.stringify(event) + '\n');
const usage = { requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, modelLatencyMs: 0, ...checkpoint?.usage };
const policyHash = digest([PROFILE, ...['strategist.txt', 'combat.txt', 'actuator.txt', 'handoff.txt', 'curriculum.txt', 'critic.txt', 'reflection.txt', 'player.mjs', 'planner.mjs', 'executor.mjs', 'state.mjs', 'agents.mjs', 'actuator.mjs', 'context.mjs', 'curriculum.mjs', 'retrieval.mjs', 'navigation.mjs', 'encounter.mjs', 'pacing.mjs', 'memory.mjs', 'incidents.mjs', 'profile.mjs', 'models.json', 'settings.json'].map(file => fs.readFileSync(new URL(file, import.meta.url), 'utf8'))]);
const catalog = new ObservationCatalog(directory);
const started = checkpoint?.started || Date.now();
let totalInputs = checkpoint?.totalInputs || 0;
let verifiedPlays = checkpoint?.verifiedPlays || 0;
let actionFailures = checkpoint?.actionFailures || 0;
const executionMetrics = { sensors: 0, screenshots: 0, completedActions: 0, batches: 0, ...checkpoint?.executionMetrics };
let build = null;
let lastState = checkpoint?.lastState || null;
const encounter = new EncounterScratchpad();
const act1Timer = new Act1Timer(checkpoint?.act1Timer);
let lifecycle = 'idle';
let attention = checkpoint?.attention || null;
let requiresResume = Boolean(checkpoint);
const recentSensors = [];
const recentInputs = [];
const record = event => {
  if (event.type === 'overhead') act1Timer.add(event.kind, event.milliseconds);
  if (event.type === 'sensor') {
    act1Timer.observe(event.state);
    executionMetrics.sensors++;
    // Startup may cross multiple verified menu boundaries in one model plan.
    if (event.state?.menu_screen === 'character_select') sawCharacterSelect = true;
    if (event.state?.run?.floor === 1 && sawCharacterSelect) freshRunVerified = true;
    recentSensors.push({ at: Date.now(), ...event });
    if (recentSensors.length > 24) recentSensors.shift();
    return;
  }
  if (event.type === 'model_usage') {
    act1Timer.add('model', event.latencyMs || 0);
    usage.requests++;
    usage.modelLatencyMs += event.latencyMs || 0;
    for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'totalTokens']) usage[key] += Number(event.usage?.[key] || 0);
  }
  if (event.type === 'input') {
    totalInputs++;
    recentInputs.push({ at: Date.now(), ...event });
    if (recentInputs.length > 24) recentInputs.shift();
  }
  if (event.type === 'action' && event.action?.type === 'play' && event.verified) verifiedPlays++;
  if (event.type === 'action_failure' || event.type === 'planner_failure') actionFailures++;
  fs.appendFileSync(path.join(directory, 'events.jsonl'), JSON.stringify({ at: Date.now(), version: VERSION, sessionId, decision, ...event }) + '\n');
};
const roster = new Roster({ emit, record });
const planner = new Planner({ emit, record });
let active = false;
let controller;
// Older checkpoints stored plain strings; every instruction now carries the decision it arrived at
// so a one-time retry directive is not mistaken for a standing order.
let instructions = (checkpoint?.instructions || []).map(item => (typeof item === 'string' ? { at_decision: null, from: 'supervisor review', text: item } : item));
let strategy = checkpoint?.strategy || '';
let decision = checkpoint?.decision || 0;
// One last_result per lane. An agent that is handed somebody else's rejection
// re-plans a screen it never saw, so each member reads only what came back from
// its own last attempt.
let laneResults = checkpoint?.laneResults || {};
let lastResult = checkpoint?.lastResult || null;
// The report the last encounter agent handed back. It is verified evidence
// about this run's deck, so it outlives the fight and reaches the drafting
// decisions that come after it.
let lastEncounter = checkpoint?.lastEncounter || null;
let fights = checkpoint?.fights || 0;
let accepted = [];
let taskText = checkpoint?.taskText || '';
let freshRunVerified = checkpoint?.freshRunVerified || false;
let sawCharacterSelect = checkpoint?.sawCharacterSelect || false;
let memorySeed = null;
try {
  const file = path.join(directory, 'accepted.json');
  if (fs.statSync(file).size <= 12000) memorySeed = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch { }

// Voyager's two load-bearing components: a curriculum that proposes the next
// objective, and a critic that decides whether it was met. The ladder lives in
// the skill library, so it is inherited rather than restarted with each room.
// Constructed after the counters above, because it journals through record(),
// which reads `decision`.
const curriculum = new Curriculum({ skillDir, planner, record, playerName: PROFILE.name, roomId: process.env.STEAMBENCH_ROOM_ID || null });
let noteIndex = indexNotes(skillDir);

function saveMetrics() {
  const act1 = act1Timer.summary();
  fs.writeFileSync(path.join(directory, 'act1-timer.json'), JSON.stringify(act1));
  fs.writeFileSync(path.join(directory, 'metrics.json'), JSON.stringify({ version: VERSION, playerName: PROFILE.name, model: PROFILE.model, reasoning: PROFILE.reasoning, compatibility: build, lifecycle, decisions: decision, inputs: totalInputs, verifiedPlays, actionFailures, executionMetrics, elapsedMs: Date.now() - started, floor: lastState?.run?.floor, act: lastState?.run?.act, attention, act1, acceptedMemoryHash: digest(accepted), objective: curriculum.active, objectivesCompleted: curriculum.completed.length, objectivesFailed: curriculum.failed.length, agents: roster.list, usage }, null, 2));
  const saved = { act1Timer: act1Timer.data, version: VERSION, policyHash, started, taskText, instructions, strategy, decision, lastResult, laneResults, lastEncounter, fights, lastState, freshRunVerified, sawCharacterSelect, attention, usage, totalInputs, verifiedPlays, actionFailures, executionMetrics };
  const temporary = path.join(directory, 'checkpoint.tmp');
  fs.writeFileSync(temporary, JSON.stringify(saved));
  fs.renameSync(temporary, path.join(directory, 'checkpoint.json'));
}

// The operator answers a paused player either through the explicit resume route or by replying in
// the room chat. Both record the review, clear the pending issue and mark the previous error
// historical; only the explicit route can acknowledge an incident ID.
function acknowledge(text, { via, issueId = null }) {
  const resolution = { at: Date.now(), issueId: attention?.id || null, acknowledgedIssueId: issueId, via, message: text.slice(0, 2000), policyHash };
  fs.appendFileSync(path.join(directory, 'incident-resolutions.jsonl'), JSON.stringify(resolution) + '\n');
  if (attention) fs.writeFileSync(path.join(directory, 'attention.json'), JSON.stringify({ ...attention, status: 'resolved', resolution }, null, 2));
  attention = null;
  requiresResume = false;
  instructions = [...instructions, { at_decision: decision, from: via === 'chat' ? 'operator chat reply' : 'supervisor review', text: resolution.message }].slice(-3);
  if (lastResult) lastResult = { ...lastResult, supervisor_reviewed: true };
  emit({ type: 'steambench_attention', attention: null });
  saveMetrics();
  return resolution;
}

function message(text, agent = LANE.room) {
  roster.as(agent, { type: 'message_start' });
  roster.as(agent, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: text } });
  roster.as(agent, { type: 'message_update', assistantMessageEvent: { type: 'text_end' } });
}

async function run(task) {
  active = true;
  encounter.reset();
  controller = new AbortController();
  const executor = new Executor({ call: gateway.call, record, signal: controller.signal, skillDir });
  const actuator = new Actuator({
    planner, executor, roster, record,
    screenshot: async () => {
      executionMetrics.screenshots++;
      const shot = await gateway.call({ op: 'screenshot', format: 'jpeg' });
      if (shot.age_ms > 2000) throw new Error('screenshot is stale; refusing to act without current visual evidence');
      return shot;
    },
  });
  emit({ type: 'agent_start' });
  lifecycle = 'running';
  message(`${PROFILE.name} · ${PROFILE.provider}/${PROFILE.model} · ${PROFILE.reasoning} reasoning. Strategist routes and drafts, an encounter agent plays each fight, the actuator owns the pad.`);
  let unchanged = 0;
  let stalePlans = 0;
  let refines = 0;
  let upstreamRetries = 0;
  let quiet = 0;
  let probes = 0;
  let previous = '';
  let previousInput = '';
  let repeatedInput = 0;
  let observation = lastState;
  let plan = null;
  let objectiveCheck = null;
  // The encounter agent that is currently open, or null between fights.
  let fight = null;
  // What the critic reads: the outcomes this run actually verified, not what any
  // plan intended. Bounded, newest last.
  const evidence = [];
  /**
   * Voyager refines a rejected program with the error in its next prompt rather
   * than escalating. That is safe here only while nothing has reached the game:
   * a plan the runtime rejected, or one that was already stale, sent no input,
   * so the scene is untouched and re-planning cannot compound a mistake. Once
   * input has been sent and failed, the first-error pause still holds exactly as
   * before. The correction goes to the lane that produced the plan - handing a
   * strategist's rejection to the actuator asks the wrong agent to fix it.
   */
  const refine = (error, guidance, lane = LANE.strategist) => {
    if (refines >= 2) throw new Error(`${error} (${refines} refinement rounds already spent without reaching a usable plan)`);
    refines++;
    lastResult = { error, refine_round: refines, no_input_sent: true, guidance };
    laneResults[lane] = lastResult;
    record({ type: 'refine', agent: lane, round: refines, error });
    saveMetrics();
  };

  /**
   * Open an encounter agent for the fight that just started. The briefing is
   * assembled from live state and the strategist's standing plan rather than
   * asked for, so a fight opens without spending a model call on it.
   */
  const openFight = (state, kind) => {
    fights++;
    const lane = encounterLane(state, fights);
    const title = encounterTitle(state, kind);
    roster.open(lane, { role: 'combat', title, parent: LANE.strategist });
    fight = {
      lane, kind, title,
      act: state.run?.act ?? null,
      floor: state.run?.floor ?? null,
      enteredHp: state.player?.hp ?? null,
      enemies: [...new Set((state.battle?.enemies || []).map(enemy => enemy.name).filter(Boolean))],
      briefing: briefing({ state, kind, strategy, objective: curriculum.active, task }),
      openedAt: decision,
    };
    record({ type: 'encounter_open', agent: lane, kind, floor: fight.floor, enemies: fight.enemies });
    message(`Opened for the ${title}. Entering at ${fight.enteredHp} HP.`, lane);
  };

  /**
   * Close it, and hand one report back. This is the whole point of the split:
   * the strategist never sees a turn of combat, so what it gets is the few
   * facts the fight actually established - what it cost, what carried it, and
   * what the deck still cannot do.
   */
  const readJsonl = (file, limit) => {
    try {
      return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-limit)
        .map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  };
  const readIncidents = (dir) => {
    try {
      return fs.readdirSync(path.join(dir, 'incidents'), { withFileTypes: true })
        .filter(entry => entry.isDirectory()).slice(-12)
        .map(entry => {
          try {
            const saved = JSON.parse(fs.readFileSync(path.join(dir, 'incidents', entry.name, 'incident.json'), 'utf8'));
            return { id: saved.id, decision: saved.decision, error: String(saved.error || '').slice(0, 300), agent: saved.agents?.find(item => item.status === 'open')?.id ?? null };
          } catch { return null; }
        }).filter(Boolean);
    } catch { return []; }
  };

  // The run's own account of itself, in the file a human reads afterwards.
  //
  // It used to be written only by a `learn` action, and across a 116-decision
  // run - six incidents, five fights, an act cleared - not one was emitted, so
  // the file stayed at its template header. Nothing here waits to be
  // remembered: a fight writes its report when it closes, an incident writes
  // itself when it pauses the run, and the team writes a reflection at the end.
  // A room deleted mid-run therefore still leaves an account behind.
  const reflect = (heading, lines) => {
    const file = path.join(skillDir, SCRATCHPAD_NOTE);
    const body = lines.filter(Boolean).map(line => `- ${line}`).join('\n');
    if (!body) return;
    try {
      fs.appendFileSync(file, `${fs.existsSync(file) ? '' : REFLECTION_HEADER}## ${heading}\n\n${body}\n\n`);
    } catch (error) { record({ type: 'reflection_write_failure', error: error.message }); }
  };

  const closeFight = async (state, fallback) => {
    if (!fight) return;
    const { lane, kind } = fight;
    const exitHp = state?.player?.hp ?? null;
    const report = await handoff(state, fallback, exitHp).catch(error => {
      record({ type: 'handoff_failure', agent: lane, error: error.message });
      return null;
    });
    const closing = report || {
      outcome: fallback,
      hp_cost: Number.isInteger(fight.enteredHp) && Number.isInteger(exitHp) ? fight.enteredHp - exitHp : null,
      worked: null, struggled: null, deck_need: null, enemy_note: null,
      unreported: 'the encounter agent did not answer; the outcome and HP are the runtime\'s own arithmetic',
    };
    lastEncounter = { kind, act: fight.act, floor: fight.floor, enemies: fight.enemies, ...closing };
    fs.appendFileSync(path.join(directory, 'encounters.jsonl'), JSON.stringify({ at: Date.now(), decision, sessionId, lane, ...lastEncounter }) + '\n');
    roster.close(lane, { outcome: closing.outcome, summary: [closing.worked, closing.deck_need].filter(Boolean).join(' — ') || null });
    record({ type: 'encounter_close', agent: lane, ...lastEncounter });
    reflect(`Encounter ${lane} — ${kind} on act ${fight.act} floor ${fight.floor}`, [
      `Outcome: ${closing.outcome}${Number.isInteger(closing.hp_cost) ? `, cost ${closing.hp_cost} HP` : ''}.`,
      fight.enemies?.length ? `Enemies: ${fight.enemies.join(', ')}.` : null,
      closing.worked && `Worked: ${closing.worked}`,
      closing.struggled && `Struggled: ${closing.struggled}`,
      closing.deck_need && `Deck need: ${closing.deck_need}`,
      closing.enemy_note && `Enemy note: ${closing.enemy_note}`,
    ]);
    message(`Report: ${closing.outcome}${Number.isInteger(closing.hp_cost) ? `, ${closing.hp_cost} HP` : ''}.${closing.worked ? ` ${closing.worked}` : ''}${closing.deck_need ? ` Deck needs: ${closing.deck_need}` : ''}`, lane);
    delete laneResults[lane];
    fight = null;
  };

  /** The encounter agent's closing call: six bounded fields, nothing else. */
  const handoff = async (state, fallback, exitHp) => {
    const context = {
      briefing: fight.briefing,
      runtime_outcome: fallback,
      entered_at_hp: fight.enteredHp,
      ended_at_hp: exitHp,
      enemies: fight.enemies,
      rounds: fight.briefing?.rounds ?? null,
      verified_evidence: evidence.filter(item => item.decision >= fight.openedAt).slice(-16),
      final_state: state ? { state_type: state.state_type, hp: state.player?.hp, max_hp: state.player?.max_hp, relics: (state.player?.relics || []).map(relic => relic.name) } : null,
    };
    const answer = await planner.ask({ role: 'handoff', agent: fight.lane, prompt: 'handoff.txt', context, deadlineMs: 45000 });
    const text = (value, limit) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null);
    return {
      outcome: ['won', 'lost', 'left'].includes(answer?.outcome) ? answer.outcome : fallback,
      hp_cost: Number.isInteger(answer?.hp_cost) ? answer.hp_cost : Number.isInteger(fight.enteredHp) && Number.isInteger(exitHp) ? fight.enteredHp - exitHp : null,
      worked: text(answer?.worked, 300),
      struggled: text(answer?.struggled, 300),
      deck_need: text(answer?.deck_need, 300),
      enemy_note: text(answer?.enemy_note, 400),
    };
  };

  try {
    while (decision < 800) {
      decision++;
      controller.signal.throwIfAborted();
      plan = null;
      let state;
      for (let refresh = 0; refresh <= 2; refresh++) {
        try { state = await executor.quiesced(); break; }
        catch (error) { if (refresh === 2 || controller.signal.aborted) throw error; }
      }
      lastState = state;
      observation = state;
      build = compatibility(state, policyHash);
      if (state.ui?.sensor_version !== SENSOR_VERSION || state.ui.error) throw new Error('read-only learning UI sensor is missing or incompatible; install the matching sensor mod build');
      accepted = acceptedLessons(memorySeed, build);
      const current = stateId(state);
      // A refinement round and a note-writing decision both deliberately send
      // no input, so an unchanged observation after either proves nothing and
      // must not count as being stuck. Each is bounded on its own instead.
      const refining = Boolean(lastResult?.refine_round);
      if (!refining && !quiet) {
        unchanged = current === previous ? unchanged + 1 : 0;
        if (unchanged >= 3) throw new Error('three observations without gameplay progress; requesting supervisor inspection');
      }
      previous = current;
      if (state.menu_screen === 'character_select') sawCharacterSelect = true;
      if (state.run?.floor === 1 && sawCharacterSelect) freshRunVerified = true;
      const combatMemory = encounter.observe(state);
      fs.writeFileSync(path.join(directory, 'encounter.json'), JSON.stringify(combatMemory));
      const compact = compactState(state);
      record({ type: 'observation', decision, state });
      catalog.observe(state, decision, build);
      fs.writeFileSync(path.join(directory, 'facts.json'), JSON.stringify({ version: VERSION, decision, observedAt: Date.now(), state: compact }, null, 2));

      if (state.state_type === 'game_over' && freshRunVerified) {
        const result = state.game_over?.win === true || state.game_over?.victory === true ? 'won' : state.game_over?.win === false || state.game_over?.victory === false || state.player?.hp === 0 ? 'lost' : null;
        if (!result) throw new Error('game_over result needs verification; refusing to guess');
        await closeFight(state, result);
        if (curriculum.active) await curriculum.verify(state, { decision, evidence }).catch(() => {});
        curriculum.closeRun(state, { decision, result });
        const summary = `${PROFILE.name}: ${result}; act ${state.run?.act}, floor ${state.run?.floor}; ${decision} decisions across ${fights} encounters.`;
        const finished = await gateway.call({ op: 'room-finish', result, summary });
        lifecycle = result;
        record({ type: 'run_finished', result, state });
        reflect(`Run ${result}`, [summary, `Standing task: ${task.slice(0, 200)}`]);
        // One call, at the one moment the whole run is visible. A failure here
        // must never be what ends a run badly: the incremental sections above
        // are already on disk and are the account that matters.
        try {
          const answer = await planner.ask({ role: 'reflection', agent: LANE.room, prompt: 'reflection.txt', context: {
            ended: { result, act: state.run?.act ?? null, floor: state.run?.floor ?? null, decisions: decision, encounters: fights },
            standing_task: task.slice(0, 1500),
            objectives: curriculum.summary(),
            encounter_reports: readJsonl(path.join(directory, 'encounters.jsonl'), 24),
            incidents: readIncidents(directory),
          }, deadlineMs: PROFILE.plannerDeadlineMs });
          const list = (value) => (Array.isArray(value) ? value.map(item => String(item).slice(0, 300)) : []);
          reflect('Reflection', [answer?.verdict && `**${String(answer.verdict).slice(0, 300)}**`]);
          for (const [heading, key] of [['What went well', 'went_well'], ['What went wrong', 'went_wrong'],
            ['Interface', 'interface'], ['Library gaps', 'library_gaps'], ['For the next run', 'next_run']]) {
            reflect(heading, list(answer?.[key]));
          }
          message('Reflection written to scratchpad.md.', LANE.room);
        } catch (error) { record({ type: 'reflection_failure', error: error.message }); }
        message(JSON.stringify(finished));
        return;
      }

      // ---- who plays this decision ----
      // A fight belongs to its own agent, opened when the encounter starts and
      // closed with one report when it ends. Menus belong to the actuator
      // alone: there is no strategy in a title screen, and running one through
      // a play prompt spends the whole context on button pressing. Everything
      // else - map, rewards, shops, events, rest sites - is the strategist's.
      const kind = encounterKind(state);
      if (fight && (!kind || fight.floor !== (state.run?.floor ?? null))) await closeFight(state, state.player?.hp === 0 ? 'lost' : 'won');
      if (kind && !fight) openFight(state, kind);
      // A menu is actuation and nothing else: there is no card, enemy or route
      // to weigh on a title screen, and running one through a play prompt spends
      // the whole context on button pressing.
      const startup = state.state_type === 'menu';
      const role = startup ? 'actuator' : fight ? 'combat' : 'strategist';
      const lane = startup ? LANE.actuator : fight ? fight.lane : LANE.strategist;

      // Self-verification, at a real progress boundary. The critic is the only
      // thing that closes an objective; a failure's critique goes straight into
      // the next decision, which is where Voyager gets most of its value.
      const notes = learnedFiles(skillDir).filter(file => file.endsWith('.md'));
      if (!refining && !fight && curriculum.dueForCheck(state, decision)) {
        const checked = await curriculum.verify(state, { decision, evidence }).catch(error => {
          record({ type: 'critic_failure', error: error.message });
          return null;
        });
        if (checked) message(`${checked.verdict}: ${checked.reasoning || checked.objective}${checked.critique ? ` — ${checked.critique}` : ''}`, LANE.critic);
        if (checked && checked.verdict !== 'pending') objectiveCheck = checked;
      }
      curriculum.observe(state);
      // Nothing to work towards: ask the curriculum for the next objective. A
      // failure here is not fatal - the player simply plays without one.
      if (!refining && !fight && freshRunVerified && curriculum.needsObjective(state)) {
        const opened = await curriculum.propose(state, { task, decision }).catch(error => { record({ type: 'curriculum_failure', error: error.message }); return null; });
        if (opened) message(`New objective (${opened.area}): ${opened.text}\nDone when: ${opened.done_when}`, LANE.curriculum);
      }
      const ladder = curriculum.context();
      // Skill retrieval: the notes this exact situation is about, read for the
      // agent instead of waiting for it to spend a decision recalling them.
      const retrieved = retrieve(skillDir, noteIndex, state, ladder.objective);
      // The actuator's manual, always - not whatever retrieval happened to
      // score. Anything retrieval did surface is already the same file.
      const manual = controlManual(skillDir, noteIndex);
      const seenControl = new Set(manual.map(note => note.path));
      const controlNotes = [...manual, ...splitNotes(retrieved).control.filter(note => !seenControl.has(note.path))];
      lastResult = laneResults[lane] || null;

      const counters = { consecutive_no_progress: unchanged, consecutive_notes_without_acting: quiet, consecutive_probes_without_acting: probes };
      const context = role === 'combat'
        ? combatContext({ state, briefing: fight.briefing, scratchpad: combatMemory, retrieved, lastResult, instructions, notes, counters })
        : role === 'strategist'
          ? strategistContext({ state, task, ladder, objectiveCheck, retrieved, lastResult, lastEncounter, instructions, strategy, accepted, notes, act1: act1Timer.summary(), counters, freshRunVerified })
          : null;
      objectiveCheck = null;
      if (context) {
        record({ type: 'decision_context', agent: lane, role, characters: JSON.stringify(context).length, acceptedMemoryHash: digest(accepted), objective: ladder.objective?.text || null, retrieved: retrieved.map(note => note.path) });
        // Retrieved notes are the one part of the context that grows without
        // bound, so they are what gets dropped when the budget is tight.
        if (JSON.stringify(context).length > 60000) context.retrieved_notes = context.retrieved_notes.map(({ content, ...rest }) => rest);
        if (JSON.stringify(context).length > 60000) throw new Error('decision context exceeds 60,000 characters; refusing silent truncation');
      }
      act1Timer.start(state, freshRunVerified);
      saveMetrics();

      // ---- the deciding agent ----
      let source;
      try {
        if (role === 'actuator') {
          // The runtime's own intent. Startup is pure actuation - abandon what
          // is loaded, pick the character, embark - and there is nothing for a
          // strategist to weigh in it.
          source = { observation: current, summary: 'Work the menu', note: 'Runtime intent: startup and menu screens are actuation only.', actions: [{ type: 'intent', goal: task.slice(0, 300) }] };
        } else {
          roster.count(lane);
          emit({ type: 'message_start', agent: lane });
          source = validatePlan(await planner.ask({ role, agent: lane, prompt: ROLES[role].prompt, context, stream: true }), state, { role });
        }
        plan = (await actuator.resolve(source, state, { notes, controlNotes, lastResult: laneResults[LANE.actuator] || null, instructions, from: role, counters })).plan;
      }
      catch (error) {
        controller.signal.throwIfAborted();
        const failedLane = error.lane || lane;
        // The rejected plan itself, or the incident is undiagnosable: a
        // validation failure leaves no diagnostics behind, and one of these
        // paused a run with `plan: null` and nothing to read.
        record({ type: 'planner_failure', agent: failedLane, error: error.message, rejected: error.plan ?? null });
        if (error.plan) plan = error.plan;
        // The provider failing is not the model failing. Wait and ask again from
        // a fresh observation, without spending a refinement round on it.
        if (transientUpstream(error.message) && upstreamRetries < TRANSIENT_BACKOFF_MS.length) {
          const waitMs = TRANSIENT_BACKOFF_MS[upstreamRetries++];
          record({ type: 'upstream_retry', agent: failedLane, attempt: upstreamRetries, waitMs, error: error.message });
          await new Promise(resolve => setTimeout(resolve, waitMs));
          controller.signal.throwIfAborted();
          continue;
        }
        refine(`${failedLane === LANE.actuator && role !== 'actuator' ? 'actuator' : role}: ${error.message}`, plannerGuidance(error.message), failedLane);
        continue;
      }
      controller.signal.throwIfAborted();
      if (probeOnly(plan) && probes >= 2) {
        refine(`${probes} probes in a row without acting`, 'A probe tells you where focus is; three of them tell you nothing more. The focus path names the item unless it is an @Control@NNNN, and the element whose id equals focused_element carries the label. Choose one and act on it.', LANE.actuator);
        continue;
      }
      if (bookkeepingOnly(plan) && quiet >= 2) {
        refine(`${quiet} decisions in a row without touching the game`, 'Notes are worth a decision, but not three in a row. Act on the screen in front of you now, and attach the learn as the final action of that plan instead of spending another decision on it.', lane);
        continue;
      }
      const signature = digest({ state: current, actions: plan.actions });
      repeatedInput = signature === previousInput ? repeatedInput + 1 : 0;
      previousInput = signature;
      if (repeatedInput >= 1) {
        refine('same plan against unchanged state', 'The previous plan was identical and the game did not change. Send something different, or report_issue if the screen genuinely blocks you.', lane);
        continue;
      }
      encounter.hypothesize(plan.note);
      message((role === 'actuator' ? plan.summary : source.summary) || plan.summary, lane);
      const toolCallId = `learn-${sessionId}-${decision}`;
      fs.appendFileSync(path.join(directory, 'learning.jsonl'), JSON.stringify({ at: Date.now(), decision, sessionId, agent: lane, kind: 'pre_action_hypothesis', note: plan.note, evidence: toolCallId, compatibility: build }) + '\n');
      if (plan.actions[0].type === 'report_issue') throw new Error(`Agent requests help: ${plan.actions[0].issue}`);
      emit({ type: 'tool_execution_start', agent: lane, toolCallId, toolName: 'sts2_execute', args: plan });
      const batchStarted = Date.now();
      const batchSensors = executionMetrics.sensors;
      const batchInputs = executor.inputs;
      const result = await actuator.execute(plan, state);
      executionMetrics.batches++;
      executionMetrics.completedActions += result.completed.length;
      record({ type: 'decision_result', agent: lane, plan, completed: result.completed, error: result.error, latencyMs: Date.now() - batchStarted, sensorCalls: executionMetrics.sensors - batchSensors, inputs: executor.inputs - batchInputs });
      if (result.state) {
        lastState = result.state;
        encounter.observe(result.state, result.completed.filter(item => item.verified).map(item => ({ action: item.action?.type, card: item.card, barrier: item.barrier })));
        fs.writeFileSync(path.join(directory, 'encounter.json'), JSON.stringify(encounter.context()));
        act1Timer.observe(result.state);
      }
      lastResult = plannerResult(result);
      // A stale observation means the plan was never sent, not that it was
      // wrong. Handing back only "use fresh state" makes the next call re-derive
      // a screen it already understood, so give it what it decided last time and
      // exactly what moved since.
      if (result.code === 'stale_observation' && result.staleState) {
        lastResult.previous_plan = { summary: plan.summary, actions: plan.actions };
        lastResult.changed = stateDiff(state, result.staleState);
      }
      laneResults[lane] = lastResult;
      // The actuator is told how its own presses landed, whoever asked for them.
      if (lane !== LANE.actuator) laneResults[LANE.actuator] = lastResult;
      emit({ type: 'tool_execution_end', agent: lane, toolCallId, toolName: 'sts2_execute', isError: Boolean(result.error), result: { content: [{ type: 'text', text: JSON.stringify(lastResult) }] } });
      fs.appendFileSync(path.join(directory, 'learning.jsonl'), JSON.stringify({ at: Date.now(), decision, sessionId, agent: lane, kind: 'observed_outcome', evidence: toolCallId, completed: result.completed, error: result.error, ...learningDelta(state, result.state) }) + '\n');
      // The strategist's standing plan is the run's; a combat agent's is its own
      // fight's and must not leak into routing after the fight is over.
      if (source.strategy && role !== 'combat') strategy = source.strategy;
      if (source.lesson) fs.appendFileSync(path.join(directory, 'candidates.jsonl'), JSON.stringify({ id: digest({ decision, lesson: source.lesson }), version: VERSION, compatibility: build, status: 'candidate', agent: lane, text: source.lesson, decision, evidence: toolCallId, verifiedActions: result.completed, error: result.error }) + '\n');
      fs.writeFileSync(path.join(directory, 'run.md'), `# ${PROFILE.name}\n\nDecision: ${decision}\n\nStrategy (hypothesis): ${strategy}\n\nLatest verified result: ${JSON.stringify(lastResult)}\n`);
      saveMetrics();
      evidence.push({ decision, agent: lane, act: state.run?.act ?? null, floor: state.run?.floor ?? null, actions: plan.actions.map(action => action.type), completed: result.completed.map(item => ({ type: item.action?.type, verified: item.verified === true, detail: item.error || item.detail || null })), error: result.error || null, after: lastResult?.after || null });
      if (evidence.length > 24) evidence.shift();
      if (plan.actions.some(action => action.type === 'learn')) noteIndex = indexNotes(skillDir);
      quiet = bookkeepingOnly(plan) ? quiet + 1 : 0;
      probes = probeOnly(plan) ? probes + 1 : 0;
      if (result.code === 'stale_observation' && ++stalePlans < 3) continue;
      if (result.error) {
        // A resolved plan the game refused must not be resolved the same way
        // again: the next attempt goes to the actuator, which can see why.
        if (result.code !== 'stale_observation') actuator.noteFailure(state, plan);
        // Nothing reached the pad, so re-planning cannot compound a mistake and
        // the first-error pause has nothing to protect yet. A stale observation
        // is already bounded by stalePlans above and must not spend this budget
        // a second time.
        if (result.code !== 'stale_observation' && executor.inputs === batchInputs) {
          refine(result.error, 'No input reached the game and the scene is unchanged. Re-plan from this observation.', lane);
          continue;
        }
        throw new Error(result.error);
      }
      stalePlans = 0;
      refines = 0;
      upstreamRetries = 0;
    }
    throw new Error('800-decision run budget reached');
  } catch (error) {
    lifecycle = 'paused';
    requiresResume = true;
    reflect(`Paused at decision ${decision}`, [
      `Error: ${error.message}`,
      `Screen: ${lastState?.state_type ?? 'unknown'}${lastState?.ui?.scene_id ? ` (scene ${lastState.ui.scene_id})` : ''}, act ${lastState?.run?.act ?? '?'} floor ${lastState?.run?.floor ?? '?'}.`,
      `Agent: ${error.lane || (fight ? fight.lane : 'strategist')}.`,
    ]);
    if (fight) roster.close(fight.lane, { outcome: 'interrupted', summary: 'The run paused mid-encounter.' });
    await gateway.call({ op: 'pad-neutral' }, { timeoutMs: 3000 }).catch(() => {});
    let after = recentSensors.at(-1)?.state || lastState;
    let afterImage = null;
    try { after = JSON.parse((await gateway.call({ op: 'sts2-get', path: '/api/v1/singleplayer', query: { format: 'json' } })).body); } catch { }
    try { executionMetrics.screenshots++; afterImage = await gateway.call({ op: 'screenshot', format: 'jpeg' }); } catch { }
    const reason = String(error.message).replaceAll(process.env[PROFILE.apiKeyEnv] || 'NO_KEY', '[redacted]').replace(/sk-(?:or-v1-)?[a-zA-Z0-9_-]{20,}/g, '[redacted]');
    if (!controller.signal.aborted) {
      const logFile = path.join(directory, 'events.jsonl');
      attention = saveIncident(directory, { decision, sessionId, error: reason, model: PROFILE.model, reasoning: PROFILE.reasoning, compatibility: build, agents: roster.list, before: observation, after, beforeImage: actuator.lastImage, afterImage, plan, planner: planner.lastDiagnostics, lastResult, recentInputs, recentSensors, eventLogBytes: fs.existsSync(logFile) ? fs.statSync(logFile).size : 0 });
      emit({ type: 'steambench_attention', attention });
      message(`SUPERVISOR REQUIRED [${attention.id}]: ${reason}\nEvidence: ${attention.path}\nNo further gameplay inputs until explicit resume.`);
    } else message('Player paused by operator; no further gameplay inputs.');
    if (after) lastState = after;
    record({ type: 'paused', error: reason, attention });
  } finally {
    saveMetrics();
    await gateway.call({ op: 'pad-neutral' }).catch(() => {});
    active = false;
    emit({ type: 'agent_settled' });
  }
}

if (process.argv.includes('--smoke')) {
  const state = { state_type: 'event', run: { act: 1, floor: 1 }, player: { hp: 80 }, ui: { sensor_version: SENSOR_VERSION } };
  const plan = await planner.ask({ role: 'strategist', prompt: ROLES.strategist.prompt, stream: true, context: { task: 'Smoke test: choose a standalone wait action. No game is connected.', observation_id: stateId(state), state } });
  validatePlan(plan, state, { role: 'strategist' });
  console.log(JSON.stringify({ smoke: 'passed', model: PROFILE.model, reasoning: PROFILE.reasoning, roles: Object.keys(ROLES), plan }));
} else {
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', async line => {
    let command;
    try {
      command = JSON.parse(line);
      if (command.type === 'get_state') {
        emit({ type: 'response', id: command.id, command: command.type, success: true, data: { isStreaming: active, model: PROFILE.model, thinkingLevel: PROFILE.reasoning, player: VERSION, displayName: PROFILE.name, attention, requiresResume, checkpointRestored: Boolean(checkpoint) } });
        if (attention) emit({ type: 'steambench_attention', attention });
      }
      else if (command.type === 'resume') {
        if (active) throw new Error('player is already running');
        if (!taskText) throw new Error('no existing task to resume');
        if (attention && command.issueId !== attention.id) throw new Error(`explicit acknowledgement of issue ${attention.id} is required`);
        if (typeof command.message !== 'string' || !command.message.trim()) throw new Error('resume requires the supervisor review/fix description');
        acknowledge(command.message, { via: 'resume', issueId: command.issueId || null });
        emit({ type: 'response', id: command.id, command: command.type, success: true });
        void run(taskText);
      }
      else if (command.type === 'prompt' || command.type === 'steer') {
        if (typeof command.message !== 'string' || !command.message.trim()) throw new Error('message required');
        if (active && (attention || requiresResume)) throw new Error('player is still stopping; wait for it to settle before replying');
        // A chat reply answers a paused, reloaded or issue-reporting player: it clears the pending
        // issue and restarts the same run. The resolution journal records that it came from chat.
        const answering = Boolean(attention || requiresResume);
        if (answering) throw new Error('player is paused; use the explicit resume operation with the incident ID');
        emit({ type: 'response', id: command.id, command: command.type, success: true });
        if (!taskText) taskText = command.message;
        else if (!answering) instructions = [...instructions, { at_decision: decision, from: 'operator chat', text: command.message.slice(0, 2000) }].slice(-3);
        saveMetrics();
        if (!active) void run(taskText);
      } else if (command.type === 'abort') {
        controller?.abort();
        await planner.abort();
        emit({ type: 'response', id: command.id, command: command.type, success: true });
      } else throw new Error('unsupported RPC command');
    } catch (error) { emit({ type: 'response', id: command?.id, command: command?.type, success: false, error: error.message }); }
  });
  input.on('close', () => { controller?.abort(); void planner.abort(); });
  process.on('SIGTERM', () => { controller?.abort(); void planner.abort(); });
}
