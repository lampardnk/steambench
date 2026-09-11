import { EncounterScratchpad } from './encounter.mjs';
import { Act1Timer } from './pacing.mjs';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import gateway from '../gateway_client.js';
import { Planner } from './planner.mjs';
import { Executor, learnedFiles } from './executor.mjs';
import { VERSION, compactState, digest, planIdentity, plannerGuidance, plannerResult, repairObservation, repairPlan, situationId, stallReason, transientUpstream, stateDiff, stateId, validatePlan } from './state.mjs';
import { LANE, ROLES, Roster, encounterLane, encounterTitle } from './agents.mjs';
import { briefing, combatContext, encounterKind, encounterOver, strategistContext } from './context.mjs';
import { ObservationCatalog, acceptedLessons, compatibility } from './memory.mjs';
import { Curriculum } from './curriculum.mjs';
import { indexNotes, retrieve } from './retrieval.mjs';

// Actions that read or write knowledge and never mutate the game. A decision made
// only of these cannot change the game, which matters twice below: an unchanged
// observation after one proves nothing about being stuck, and a run of them is
// note-taking crowding out play.
const BOOKKEEPING = new Set(['learn', 'recall', 'research', 'lookup']);
const bookkeepingOnly = (plan) => plan.actions.every(action => BOOKKEEPING.has(action.type));
const TRANSIENT_BACKOFF_MS = [2000, 5000, 12000, 30000];

// How many consecutive actions may be spent inside too few distinct situations
// before the run is stopped for a supervisor.
//
// Measured against all eight recorded runs. Sixteen actions, not eight: at eight
// this fires on four runs, three of which recovered within six actions - a fight
// where a turn merely ended, and a screen that was being read - whereas sixteen
// fires only on screens a run was genuinely thrashing. The five runs that kept
// moving never fell below six distinct situations in a window; all three this
// stops had collapsed to two:
//   * 346 actions left cycling a reward list and the card screen behind it
//     (live, 499k tokens of run budget in the window alone),
//   * 212 left alternating two card-upgrade selections, an 84-action screen the
//     run escaped only 67 actions after this would have stopped it,
//   * 19 left cycling a card reward.
// Three situations, not one: a screen and the overlay it opens are two
// situations, which is what makes `progressId` count the live loop as
// movement, and neither is a third. Stopping the middle run early is the
// intent, not a cost: it had spent 84 actions on one card-upgrade screen by
// the time the guard fires.
const STALL_WINDOW = 16;
const STALL_SITUATIONS = 3;

// One reversible directional press, sent to find out where focus actually is.
// It answers a question, so a run of them means the question is not the problem.
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
const policyHash = digest([PROFILE, ...['strategist.txt', 'combat.txt', 'handoff.txt', 'curriculum.txt', 'critic.txt', 'player.mjs', 'planner.mjs', 'executor.mjs', 'state.mjs', 'agents.mjs', 'context.mjs', 'curriculum.mjs', 'retrieval.mjs', 'encounter.mjs', 'pacing.mjs', 'memory.mjs', 'incidents.mjs', 'profile.mjs', 'models.json', 'settings.json'].map(file => fs.readFileSync(new URL(file, import.meta.url), 'utf8'))]);
const catalog = new ObservationCatalog(directory);
const started = checkpoint?.started || Date.now();
let totalActions = checkpoint?.totalActions ?? checkpoint?.totalInputs ?? 0;
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
const recentActions = [];
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
  if (event.type === 'action_dispatch') {
    totalActions++;
    recentActions.push({ at: Date.now(), ...event });
    if (recentActions.length > 24) recentActions.shift();
  }
  if (event.type === 'action' && event.action?.type === 'play' && event.verified) verifiedPlays++;
  if (event.type === 'action_failure' || event.type === 'planner_failure') actionFailures++;
  fs.appendFileSync(path.join(directory, 'events.jsonl'), JSON.stringify({ at: Date.now(), version: VERSION, sessionId, decision, ...event }) + '\n');
};
const roster = new Roster({ emit, record });
const planner = new Planner({ emit, record });
let active = false;
let abortRun;
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

// The curriculum and critic track objectives for this run only. Their ladder
// stays in the room scratchpad and is never inherited by a different seed.
// Constructed after the counters above, because it journals through record(),
// which reads `decision`.
const curriculum = new Curriculum({ skillDir, planner, record, playerName: PROFILE.name, roomId: process.env.STEAMBENCH_ROOM_ID || null });
let noteIndex = indexNotes(skillDir);

function saveMetrics() {
  const act1 = act1Timer.summary();
  fs.writeFileSync(path.join(directory, 'act1-timer.json'), JSON.stringify(act1));
  fs.writeFileSync(path.join(directory, 'metrics.json'), JSON.stringify({ version: VERSION, playerName: PROFILE.name, model: PROFILE.model, reasoning: PROFILE.reasoning, compatibility: build, lifecycle, decisions: decision, actions: totalActions, verifiedPlays, actionFailures, executionMetrics, elapsedMs: Date.now() - started, floor: lastState?.run?.floor, act: lastState?.run?.act, attention, act1, acceptedMemoryHash: digest(accepted), objective: curriculum.active, objectivesCompleted: curriculum.completed.length, objectivesFailed: curriculum.failed.length, agents: roster.list, usage }, null, 2));
  const saved = { act1Timer: act1Timer.data, version: VERSION, policyHash, started, taskText, instructions, strategy, decision, lastResult, laneResults, lastEncounter, fights, lastState, freshRunVerified, sawCharacterSelect, attention, usage, totalActions, verifiedPlays, actionFailures, executionMetrics };
  const temporary = path.join(directory, 'checkpoint.tmp');
  fs.writeFileSync(temporary, JSON.stringify(saved));
  fs.renameSync(temporary, path.join(directory, 'checkpoint.json'));
}

// The dashboard reply-and-resume button uses the explicit resume route,
// carrying the displayed incident ID and the operator review.
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
  abortRun = new AbortController();
  const executor = new Executor({ call: gateway.call, record, signal: abortRun.signal, skillDir });
  emit({ type: 'agent_start' });
  lifecycle = 'running';
  message(`${PROFILE.name} · ${PROFILE.provider}/${PROFILE.model} · ${PROFILE.reasoning} reasoning. The strategist owns startup and noncombat choices; one encounter agent plays each fight; STS2MCP is the sole gameplay action path.`);
  let unchanged = 0;
  let stalePlans = 0;
  let refines = 0;
  let upstreamRetries = 0;
  let quiet = 0;
  let previous = '';
  let previousInput = '';
  let repeatedInput = 0;
  // The situations the last few actions were spent in. A run that keeps acting
  // without the situation ever changing is not deciding anything, and the
  // existing guards cannot see it: `unchanged` compares the whole stateId and
  // `repeatedInput` compares one plan against the next, so a two-screen cycle
  // reads as progress to both. See situationId.
  const situations = [];
  let observation = lastState;
  let plan = null;
  let beforeImage = null;
  let objectiveCheck = null;
  // The encounter agent that is currently open, or null between fights.
  let fight = null;
  // What the critic reads: the outcomes this run actually verified, not what any
  // plan intended. Bounded, newest last.
  const evidence = [];
  /**
   * Voyager refines a rejected program with the error in its next prompt rather
   * than escalating. That is safe here only while nothing has reached the game:
   * a plan the runtime rejected, or one that was already stale, sent no action,
   * so the scene is untouched and re-planning cannot compound a mistake. Once
   * an action has been sent and failed, the first-error pause still holds exactly as
   * before. The correction goes to the lane that produced the plan - handing a
   * a rejection must return to the role that authored the plan.
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
    // The outcome and the HP are measurements, and the runtime took them. Both
    // used to be overridable by the closing report, and the report said "won,
    // 11 HP" over a live elite - the enemy at 33 HP, the player at 46/80, 11
    // matching nothing on screen. The encounter agent describes the fight; it
    // does not get to state its result. A disagreement belongs in `struggled`,
    // where it is read rather than believed.
    return {
      outcome: fallback,
      hp_cost: Number.isInteger(fight.enteredHp) && Number.isInteger(exitHp) ? fight.enteredHp - exitHp : null,
      ...(answer?.outcome && answer.outcome !== fallback ? { disputed_outcome: String(answer.outcome).slice(0, 20) } : {}),
      worked: text(answer?.worked, 300),
      struggled: text(answer?.struggled, 300),
      deck_need: text(answer?.deck_need, 300),
      enemy_note: text(answer?.enemy_note, 400),
    };
  };

  try {
    while (decision < 800) {
      decision++;
      abortRun.signal.throwIfAborted();
      plan = null;
      let state;
      for (let refresh = 0; refresh <= 2; refresh++) {
        try { state = await executor.quiesced(); break; }
        catch (error) { if (refresh === 2 || abortRun.signal.aborted) throw error; }
      }
      lastState = state;
      observation = state;
      build = compatibility(state, policyHash);
      if (!state.build?.game || !state.build?.mod || state.sensor_error) throw new Error('STS2MCP structured-state extension is missing or incompatible; install the matching mod build');
      accepted = acceptedLessons(memorySeed, build);
      const current = stateId(state);
      // A refinement round and a note-writing decision both deliberately send
      // no action, so an unchanged observation after either proves nothing and
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
        // Completion is recorded as measured telemetry. No narrative run
        // reflection or advice for a different seed is written to the library.
        message(JSON.stringify(finished));
        return;
      }

      // ---- who plays this decision ----
      // A fight belongs to its own agent, opened when the encounter starts and
      // closed with one report when it ends. The strategist also owns startup
      // and every noncombat semantic choice.
      const kind = encounterKind(state);
      // Not "this screen is not combat" - that closed an elite because a
      // potion put a card-choice overlay in front of it. The encounter ends
      // when the game has left it.
      if (fight && encounterOver(state, fight)) await closeFight(state, state.player?.hp === 0 ? 'lost' : 'won');
      if (kind && !fight) openFight(state, kind);
      const role = fight ? 'combat' : 'strategist';
      const lane = fight ? fight.lane : LANE.strategist;

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
      lastResult = laneResults[lane] || null;

      const counters = { consecutive_no_progress: unchanged, consecutive_notes_without_acting: quiet };
      const context = role === 'combat'
        ? combatContext({ state, briefing: fight.briefing, scratchpad: combatMemory, retrieved, lastResult, instructions, notes, counters })
        : role === 'strategist'
          ? strategistContext({ state, task, ladder, objectiveCheck, retrieved, lastResult, lastEncounter, instructions, strategy, accepted, notes, act1: act1Timer.summary(), counters, freshRunVerified })
          : null;
      objectiveCheck = null;
      if (context) {
        record({ type: 'decision_context', agent: lane, role, characters: JSON.stringify(context).length, acceptedMemoryHash: digest(accepted), objective: ladder.objective?.text || null, retrieved: retrieved.map(note => note.path) });
        // Shed the lowest-ranked note bodies until the decision fits, and
        // refuse rather than send a silently gutted one.
        //
        // The old ceiling was derived from the window - (contextWindow -
        // maxTokens) * 2, which at a 1M-token window is 1,966,080 characters.
        // No decision ever came near it, so this loop never ran and the guard
        // never fired: decisions went out at whatever retrieval produced, which
        // on the live run reached 126,155 characters - 31,500 tokens - for one
        // combat decision. A ceiling has to be a number a real decision can
        // reach, or it is decoration.
        //
        // 48,000 is set from the parts rather than a percentile: the retrieval
        // budget (16,000 characters of note bodies, ~17,600 once JSON-encoded),
        // plus the largest state any recorded decision carried (18,751 for a
        // card select that lists the whole deck), plus the standing task and
        // counters. The largest context measured under this configuration is
        // 37,814, so the guard sits a third above every real decision and still
        // stops a structural runaway - a note set that ignored its budget, or a
        // state that grew without bound - instead of shipping it.
        const contextBudget = 48000;
        for (let i = context.retrieved_notes.length - 1; i >= 0 && JSON.stringify(context).length > contextBudget; i--) {
          const { content, ...metadata } = context.retrieved_notes[i];
          context.retrieved_notes[i] = { ...metadata, truncated: true, omitted_for_context_budget: true };
        }
        if (JSON.stringify(context).length > contextBudget) throw new Error(`decision context exceeds the configured ${contextBudget}-character budget; refusing silent truncation`);
      }
      act1Timer.start(state, freshRunVerified);
      saveMetrics();

      // ---- the deciding agent ----
      let source;
      try {
        roster.count(lane);
        emit({ type: 'message_start', agent: lane });
        const proposed = await planner.ask({ role, agent: lane, prompt: ROLES[role].prompt, context, stream: true });
        const observationRepaired = repairObservation(proposed, state);
        if (observationRepaired !== proposed) record({ type: 'planner_repair', agent: lane, repair: 'observation_prefix', originalObservation: proposed.observation, repairedObservation: observationRepaired.observation });
        const repaired = repairPlan(observationRepaired, { role });
        if (repaired !== observationRepaired) record({ type: 'planner_repair', agent: lane, originalActions: observationRepaired.actions, repairedActions: repaired.actions });
        plan = repaired;
        source = validatePlan(repaired, state, { role });
        plan = source;
      }
      catch (error) {
        abortRun.signal.throwIfAborted();
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
          abortRun.signal.throwIfAborted();
          continue;
        }
        refine(`${role}: ${error.message}`, plannerGuidance(error.message), failedLane);
        continue;
      }
      abortRun.signal.throwIfAborted();
      if (bookkeepingOnly(plan) && quiet >= 2) {
        refine(`${quiet} decisions in a row without touching the game`, 'Notes are worth a decision, but not three in a row. Act on the screen in front of you now, and attach the learn as the final action of that plan instead of spending another decision on it.', lane);
        continue;
      }
      // Has this run moved at all recently? A plan is "new" whenever its actions
      // differ, so a strategist cycling between two screens produces a fresh
      // signature every time and `repeatedInput` never fires. This asks the only
      // question that matters - is the run still reaching situations it has not
      // already been in - and stops it when the answer is no.
      const stalled = stallReason(situations, STALL_WINDOW, STALL_SITUATIONS);
      if (stalled !== null) {
        throw new Error(`${STALL_WINDOW} actions across only ${stalled} distinct situation${stalled === 1 ? '' : 's'}`
          + ` (${state.state_type} at act ${state.run?.act ?? '?'} floor ${state.run?.floor ?? '?'});`
          + ' the run is not making progress, so it is stopping for a supervisor rather than spending more actions on it');
      }
      const signature = digest({ state: current, actions: plan.actions });
      repeatedInput = signature === previousInput ? repeatedInput + 1 : 0;
      previousInput = signature;
      if (repeatedInput >= 1) {
        refine('same plan against unchanged state', 'The previous plan was identical and the game did not change. Send something different, or report_issue if the screen genuinely blocks you.', lane);
        continue;
      }
      encounter.hypothesize(plan.note);
      message(source.summary || plan.summary, lane);
      const toolCallId = `learn-${sessionId}-${decision}`;
      fs.appendFileSync(path.join(directory, 'learning.jsonl'), JSON.stringify({ at: Date.now(), decision, sessionId, agent: lane, kind: 'pre_action_hypothesis', note: plan.note, evidence: toolCallId, compatibility: build }) + '\n');
      if (plan.actions[0].type === 'report_issue') {
        // A complaint about a screen that has already gone is not an incident.
        // The planner is handed one observation and thinks for several seconds;
        // when the game moves in that window the agent sees its JSON disagree
        // with the screen and, quite correctly, refuses to act on either. It
        // does not need an operator, it needs to look again - which the next
        // pass of this loop does, because nothing was sent.
        const live = await executor.quiesced().catch(() => null);
        if (live && planIdentity(live) !== planIdentity(state)) {
          refine('the screen changed while this decision was being made',
            `What you were shown is gone: the game is now ${live.state_type}. Nothing was sent and nothing is wrong. Plan against the observation in this message.`, lane);
          continue;
        }
        // The commonest report is an agent asking where the screen it just
        // finished went. It rested, the site resolved to no options and a live
        // Proceed, and it paused asking what happened to Rest and Smith. A
        // press that worked is supposed to change the screen; the options that
        // are gone are the ones it spent.
        if (lastResult?.completed?.length && !lastResult.error) {
          refine('the last action succeeded and this is the screen it produced',
            'Your previous action completed. What you were expecting to still be here is what that action consumed, so this is progress, not a fault. Read the screen as it is now and take the next step on it.', lane);
          continue;
        }
        throw new Error(`Agent requests help: ${plan.actions[0].issue}`);
      }
      emit({ type: 'tool_execution_start', agent: lane, toolCallId, toolName: 'sts2_execute', args: plan });
      const batchStarted = Date.now();
      const batchSensors = executionMetrics.sensors;
      const batchActions = executor.actions;
      executionMetrics.screenshots++;
      beforeImage = await gateway.call({ op: 'screenshot', format: 'jpeg' }).catch(() => null);
      const result = await executor.execute(plan, state);
      executionMetrics.batches++;
      executionMetrics.completedActions += result.completed.length;
      record({ type: 'decision_result', agent: lane, plan, completed: result.completed, error: result.error, latencyMs: Date.now() - batchStarted, sensorCalls: executionMetrics.sensors - batchSensors, actions: executor.actions - batchActions });
      // Sample the situation once per batch that actually reached STS2MCP. A
      // batch that sent nothing (a stale plan, a refinement round) leaves the
      // game untouched, so counting it would report a stall the run did not
      // have. `state` is the observation the batch ran against, which is the
      // situation the actions were spent in.
      if (executor.actions > batchActions) {
        situations.push(situationId(state));
        if (situations.length > STALL_WINDOW) situations.shift();
      }
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
      emit({ type: 'tool_execution_end', agent: lane, toolCallId, toolName: 'sts2_execute', isError: Boolean(result.error), result: { content: [{ type: 'text', text: JSON.stringify(lastResult) }] } });
      fs.appendFileSync(path.join(directory, 'learning.jsonl'), JSON.stringify({ at: Date.now(), decision, sessionId, agent: lane, kind: 'observed_outcome', evidence: toolCallId, completed: result.completed, error: result.error, ...learningDelta(state, result.state) }) + '\n');
      // The strategist's standing plan is the run's; a combat agent's is its own
      // fight's and must not leak into routing after the fight is over.
      if (source.strategy && role !== 'combat') strategy = source.strategy;
      if (source.lesson) fs.appendFileSync(path.join(directory, 'candidates.jsonl'), JSON.stringify({ id: digest({ decision, lesson: source.lesson }), version: VERSION, compatibility: build, status: 'candidate', agent: lane, text: source.lesson, decision, evidence: toolCallId, verifiedActions: result.completed, error: result.error }) + '\n');
      saveMetrics();
      // The fight's own identity rides on the row: the critic was once unable to
      // settle an objective reading "an Elite encounter is won" because a floor
      // 7 win and a floor 8 Elite win looked identical in the evidence - it had
      // the floor and the HP, but nothing saying which kind of encounter it was.
      evidence.push({ decision, agent: lane, act: state.run?.act ?? null, floor: state.run?.floor ?? null, kind: fight?.kind ?? null, enemies: fight?.enemies ?? null, actions: plan.actions.map(action => action.type), completed: result.completed.map(item => ({ type: item.action?.type, verified: item.verified === true, detail: item.error || item.detail || null })), error: result.error || null, after: lastResult?.after || null });
      if (evidence.length > 24) evidence.shift();
      if (plan.actions.some(action => action.type === 'learn')) noteIndex = indexNotes(skillDir);
      quiet = bookkeepingOnly(plan) ? quiet + 1 : 0;
      if (result.code === 'stale_observation' && ++stalePlans < 3) continue;
      if (result.error) {
        // Nothing reached STS2MCP, so re-planning cannot compound a mistake and
        // the first-error pause has nothing to protect yet. A stale observation
        // is already bounded by stalePlans above and must not spend this budget
        // a second time.
        if (result.code !== 'stale_observation' && executor.actions === batchActions) {
          refine(result.error, 'No action reached the game and the scene is unchanged. Re-plan from this observation.', lane);
          continue;
        }
        // A batch that stopped cleanly part way is not a failed action. Every
        // action that ran did what it said, and the one that could not run was
        // refused before it pressed anything - so the scene is exactly what the
        // successful actions produced, and re-planning cannot compound
        // anything. Live: Molten Fist and Pommel Strike both reported cost 0
        // because a one-shot discount makes every eligible card free IF PLAYED
        // NEXT; Molten Fist spent it, Pommel Strike was correctly declined, and
        // a healthy turn paused for an operator over a card it never touched.
        if (result.code !== 'stale_observation' && result.failedActionDispatched === false && result.completed.every(item => item.verified !== false)) {
          refine(result.error, 'The actions before this one all landed; this one was refused before it pressed anything, so the screen is exactly what they produced. Re-read it and plan the rest of the turn from there.', lane);
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
    if (fight) roster.close(fight.lane, { outcome: 'interrupted', summary: 'The run paused mid-encounter.' });
    let after = recentSensors.at(-1)?.state || lastState;
    let afterImage = null;
    try { after = JSON.parse((await gateway.call({ op: 'sts2-get', path: '/api/v1/singleplayer', query: { format: 'json' } })).body); } catch { }
    try { executionMetrics.screenshots++; afterImage = await gateway.call({ op: 'screenshot', format: 'jpeg' }); } catch { }
    const reason = String(error.message).replaceAll(process.env[PROFILE.apiKeyEnv] || 'NO_KEY', '[redacted]').replace(/sk-(?:or-v1-)?[a-zA-Z0-9_-]{20,}/g, '[redacted]');
    if (!abortRun.signal.aborted) {
      const logFile = path.join(directory, 'events.jsonl');
      attention = saveIncident(directory, { decision, sessionId, error: reason, model: PROFILE.model, reasoning: PROFILE.reasoning, compatibility: build, agents: roster.list, before: observation, after, beforeImage, afterImage, plan, planner: planner.lastDiagnostics, lastResult, recentActions, recentSensors, eventLogBytes: fs.existsSync(logFile) ? fs.statSync(logFile).size : 0 });
      emit({ type: 'steambench_attention', attention });
      message(`SUPERVISOR REQUIRED [${attention.id}]: ${reason}\nEvidence: ${attention.path}\nNo further gameplay actions until explicit resume.`);
    } else message('Player paused by operator; no further gameplay actions.');
    if (after) lastState = after;
    record({ type: 'paused', error: reason, attention });
  } finally {
    saveMetrics();
    active = false;
    emit({ type: 'agent_settled' });
  }
}

if (process.argv.includes('--smoke')) {
  const state = { state_type: 'event', run: { act: 1, floor: 1 }, player: { hp: 80 }, build: { game: 'smoke', mod: 'smoke' } };
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
        // Ordinary prompts cannot acknowledge an incident. The dashboard must
        // use the explicit resume RPC with the displayed incident ID.
        const answering = Boolean(attention || requiresResume);
        if (answering) throw new Error('player is paused; use the explicit resume operation with the incident ID');
        emit({ type: 'response', id: command.id, command: command.type, success: true });
        if (!taskText) taskText = command.message;
        else if (!answering) instructions = [...instructions, { at_decision: decision, from: 'operator chat', text: command.message.slice(0, 2000) }].slice(-3);
        saveMetrics();
        if (!active) void run(taskText);
      } else if (command.type === 'abort') {
        abortRun?.abort();
        await planner.abort();
        emit({ type: 'response', id: command.id, command: command.type, success: true });
      } else throw new Error('unsupported RPC command');
    } catch (error) { emit({ type: 'response', id: command?.id, command: command?.type, success: false, error: error.message }); }
  });
  input.on('close', () => { abortRun?.abort(); void planner.abort(); });
  process.on('SIGTERM', () => { abortRun?.abort(); void planner.abort(); });
}
