import { EncounterScratchpad } from './encounter.mjs';
import { Act1Timer } from './pacing.mjs';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import gateway from '../gateway_client.js';
import { Planner } from './planner.mjs';
import { Executor, learnedFiles } from './executor.mjs';
import { DIRECTIONS, VERSION, SENSOR_VERSION, compactState, digest, needsScreenshot, plannerResult, plannerState, stateId, validatePlan } from './state.mjs';
import { ObservationCatalog, acceptedLessons, compatibility } from './memory.mjs';
import { Curriculum } from './curriculum.mjs';
import { indexNotes, retrieve } from './retrieval.mjs';

// Actions that read or write knowledge and never touch the pad. A decision made
// only of these cannot change the game, which matters twice below: an unchanged
// observation after one proves nothing about being stuck, and a run of them is
// note-taking crowding out play.
const BOOKKEEPING = new Set(['learn', 'recall', 'research', 'lookup']);
const bookkeepingOnly = (plan) => plan.actions.every(action => BOOKKEEPING.has(action.type));
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
const policyHash = digest([PROFILE, ...['prompt.txt', 'curriculum.txt', 'critic.txt', 'player.mjs', 'planner.mjs', 'executor.mjs', 'state.mjs', 'curriculum.mjs', 'retrieval.mjs', 'navigation.mjs', 'encounter.mjs', 'pacing.mjs', 'memory.mjs', 'incidents.mjs', 'profile.mjs', 'models.json', 'settings.json'].map(file => fs.readFileSync(new URL(file, import.meta.url), 'utf8'))]);
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
const planner = new Planner({ emit, record });
let active = false;
let controller;
// Older checkpoints stored plain strings; every instruction now carries the decision it arrived at
// so a one-time retry directive is not mistaken for a standing order.
let instructions = (checkpoint?.instructions || []).map(item => (typeof item === 'string' ? { at_decision: null, from: 'supervisor review', text: item } : item));
let strategy = checkpoint?.strategy || '';
let decision = checkpoint?.decision || 0;
let lastResult = checkpoint?.lastResult || null;
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
  fs.writeFileSync(path.join(directory, 'metrics.json'), JSON.stringify({ version: VERSION, playerName: PROFILE.name, model: PROFILE.model, reasoning: PROFILE.reasoning, compatibility: build, lifecycle, decisions: decision, inputs: totalInputs, verifiedPlays, actionFailures, executionMetrics, elapsedMs: Date.now() - started, floor: lastState?.run?.floor, act: lastState?.run?.act, attention, act1, acceptedMemoryHash: digest(accepted), objective: curriculum.active, objectivesCompleted: curriculum.completed.length, objectivesFailed: curriculum.failed.length, usage }, null, 2));
  const saved = { act1Timer: act1Timer.data, version: VERSION, policyHash, started, taskText, instructions, strategy, decision, lastResult, lastState, freshRunVerified, sawCharacterSelect, attention, usage, totalInputs, verifiedPlays, actionFailures, executionMetrics };
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

function message(text) {
  emit({ type: 'message_start' });
  emit({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: text } });
  emit({ type: 'message_update', assistantMessageEvent: { type: 'text_end' } });
}

async function run(task) {
  active = true;
  encounter.reset();
  controller = new AbortController();
  const executor = new Executor({ call: gateway.call, record, signal: controller.signal, skillDir });
  emit({ type: 'agent_start' });
  lifecycle = 'running';
  message(`${PROFILE.name} · ${PROFILE.provider}/${PROFILE.model} · ${PROFILE.reasoning} reasoning`);
  let unchanged = 0;
  let stalePlans = 0;
  let refines = 0;
  let quiet = 0;
  let probes = 0;
  let previous = '';
  let previousInput = '';
  let repeatedInput = 0;
  let observation = lastState;
  let beforeImage = null;
  let plan = null;
  let objectiveCheck = null;
  // What the critic reads: the outcomes this run actually verified, not what any
  // plan intended. Bounded, newest last.
  const evidence = [];
  /**
   * Voyager refines a rejected program with the error in its next prompt rather
   * than escalating. That is safe here only while nothing has reached the game:
   * a plan the runtime rejected, or one that was already stale, sent no input,
   * so the scene is untouched and re-planning cannot compound a mistake. Once
   * input has been sent and failed, the first-error pause still holds exactly as
   * before.
   */
  const refine = (error, guidance) => {
    if (refines >= 2) throw new Error(`${error} (${refines} refinement rounds already spent without reaching a usable plan)`);
    refines++;
    lastResult = { error, refine_round: refines, no_input_sent: true, guidance };
    record({ type: 'refine', round: refines, error });
    saveMetrics();
  };
  try {
    while (decision < 800) {
      decision++;
      controller.signal.throwIfAborted();
      plan = null;
      beforeImage = null;
      let state;
      for (let refresh = 0; refresh <= 2; refresh++) {
        try { state = await executor.settled(); break; }
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
        if (curriculum.active) await curriculum.verify(state, { decision, evidence }).catch(() => {});
        curriculum.closeRun(state, { decision, result });
        const summary = `${PROFILE.name}: ${result}; act ${state.run?.act}, floor ${state.run?.floor}; ${decision} decisions.`;
        const finished = await gateway.call({ op: 'room-finish', result, summary });
        lifecycle = result;
        record({ type: 'run_finished', result, state });
        message(JSON.stringify(finished));
        return;
      }
      const needsImage = needsScreenshot(state);
      if (needsImage) {
        executionMetrics.screenshots++;
        beforeImage = await gateway.call({ op: 'screenshot', format: 'jpeg' });
        if (beforeImage.age_ms > 2000) throw new Error('screenshot is stale; refusing to act without current visual evidence');
      }
      const image = beforeImage;

      // Self-verification, at a real progress boundary. The critic is the only
      // thing that closes an objective; a failure's critique goes straight into
      // the next decision, which is where Voyager gets most of its value.
      const notes = learnedFiles(skillDir).filter(file => file.endsWith('.md'));
      if (!refining && !state.battle && curriculum.dueForCheck(state, decision)) {
        const checked = await curriculum.verify(state, { decision, evidence, notes }).catch(error => {
          record({ type: 'critic_failure', error: error.message });
          return null;
        });
        if (checked && checked.verdict !== 'pending') objectiveCheck = checked;
      }
      curriculum.observe(state);
      // Nothing to work towards: ask the curriculum for the next objective. A
      // failure here is not fatal - the player simply plays without one.
      if (!refining && !state.battle && freshRunVerified && curriculum.needsObjective(state)) {
        await curriculum.propose(state, { task, notes, decision }).catch(error => record({ type: 'curriculum_failure', error: error.message }));
      }
      const ladder = curriculum.context();
      // Skill retrieval: the notes this exact situation is about, read for the
      // planner instead of waiting for it to spend a decision recalling them.
      const retrieved = retrieve(skillDir, noteIndex, state, ladder.objective);

      const context = { version: VERSION, task: task.slice(0, 6000), fresh_run_verified: freshRunVerified, observation_id: stateId(state), state: plannerState(state, lastResult, strategy), strategy, ...ladder, objective_check: objectiveCheck, retrieved_notes: retrieved, encounter_scratchpad: combatMemory, act1_timer: act1Timer.summary(), accepted_lessons: accepted, learned_notes: notes.slice(0, 120), last_result: lastResult, user_instructions: instructions.slice(-3), consecutive_no_progress: unchanged, consecutive_notes_without_acting: quiet, consecutive_probes_without_acting: probes };
      objectiveCheck = null;
      record({ type: 'decision_context', characters: JSON.stringify(context).length, screenshot: Boolean(image), acceptedMemoryHash: digest(accepted), objective: ladder.objective?.text || null, retrieved: retrieved.map(note => note.path) });
      // Retrieved notes are the one part of the context that grows without
      // bound, so they are what gets dropped when the budget is tight.
      if (JSON.stringify(context).length > 40000) context.retrieved_notes = retrieved.map(({ content, ...rest }) => rest);
      if (JSON.stringify(context).length > 40000) throw new Error('decision context exceeds 40,000 characters; refusing silent truncation');
      emit({ type: 'message_start' });
      act1Timer.start(state, freshRunVerified);
      saveMetrics();
      try { plan = validatePlan(await planner.decide(context, image), state); }
      catch (error) {
        controller.signal.throwIfAborted();
        record({ type: 'planner_failure', error: error.message });
        refine(`planner: ${error.message}`, 'The plan was rejected before any input was sent, so the scene is unchanged. Fix exactly what this message names and answer again from the same observation.');
        continue;
      }
      controller.signal.throwIfAborted();
      if (probeOnly(plan) && probes >= 2) {
        refine(`${probes} probes in a row without acting`, 'A probe tells you where focus is; five of them tell you nothing more. The focus path names the item unless it is an @Control@NNNN, the screenshot shows which one is raised, and the live state lists the options. Choose one and act on it.');
        continue;
      }
      if (bookkeepingOnly(plan) && quiet >= 2) {
        refine(`${quiet} decisions in a row without touching the game`, 'Notes are worth a decision, but not three in a row. Act on the screen in front of you now, and attach the learn as the final action of that plan instead of spending another decision on it.');
        continue;
      }
      const signature = digest({ state: stateId(state), actions: plan.actions });
      repeatedInput = signature === previousInput ? repeatedInput + 1 : 0;
      previousInput = signature;
      if (repeatedInput >= 1) {
        refine('same plan against unchanged state', 'The previous plan was identical and the game did not change. Send something different, or report_issue if the screen genuinely blocks you.');
        continue;
      }
      encounter.hypothesize(plan.note);
      message(plan.summary);
      const toolCallId = `learn-${sessionId}-${decision}`;
      fs.appendFileSync(path.join(directory, 'learning.jsonl'), JSON.stringify({ at: Date.now(), decision, sessionId, kind: 'pre_action_hypothesis', note: plan.note, evidence: toolCallId, compatibility: build }) + '\n');
      if (plan.actions[0].type === 'report_issue') throw new Error(`Agent requests help: ${plan.actions[0].issue}`);
      emit({ type: 'tool_execution_start', toolCallId, toolName: 'sts2_execute', args: plan });
      const batchStarted = Date.now();
      const batchSensors = executionMetrics.sensors;
      const batchInputs = executor.inputs;
      const result = await executor.execute(plan, state).catch(error => ({ error: error.message, code: error.code, completed: [] }));
      executionMetrics.batches++;
      executionMetrics.completedActions += result.completed.length;
      record({ type: 'decision_result', plan, completed: result.completed, error: result.error, latencyMs: Date.now() - batchStarted, sensorCalls: executionMetrics.sensors - batchSensors, inputs: executor.inputs - batchInputs });
      if (result.state) {
        lastState = result.state;
        encounter.observe(result.state, result.completed.filter(item => item.verified).map(item => ({ action: item.action?.type, card: item.card, barrier: item.barrier })));
        fs.writeFileSync(path.join(directory, 'encounter.json'), JSON.stringify(encounter.context()));
        act1Timer.observe(result.state);
      }
      lastResult = plannerResult(result);
      emit({ type: 'tool_execution_end', toolCallId, toolName: 'sts2_execute', isError: Boolean(result.error), result: { content: [{ type: 'text', text: JSON.stringify(lastResult) }] } });
      fs.appendFileSync(path.join(directory, 'learning.jsonl'), JSON.stringify({ at: Date.now(), decision, sessionId, kind: 'observed_outcome', evidence: toolCallId, completed: result.completed, error: result.error, ...learningDelta(state, result.state) }) + '\n');
      if (plan.strategy) strategy = plan.strategy;
      if (plan.lesson) fs.appendFileSync(path.join(directory, 'candidates.jsonl'), JSON.stringify({ id: digest({ decision, lesson: plan.lesson }), version: VERSION, compatibility: build, status: 'candidate', text: plan.lesson, decision, evidence: toolCallId, verifiedActions: result.completed, error: result.error }) + '\n');
      fs.writeFileSync(path.join(directory, 'run.md'), `# ${PROFILE.name}\n\nDecision: ${decision}\n\nStrategy (hypothesis): ${strategy}\n\nLatest verified result: ${JSON.stringify(lastResult)}\n`);
      saveMetrics();
      evidence.push({ decision, act: state.run?.act ?? null, floor: state.run?.floor ?? null, actions: plan.actions.map(action => action.type), completed: result.completed.map(item => ({ type: item.action?.type, verified: item.verified === true, detail: item.error || item.detail || null })), error: result.error || null, after: lastResult?.after || null });
      if (evidence.length > 24) evidence.shift();
      if (plan.actions.some(action => action.type === 'learn')) noteIndex = indexNotes(skillDir);
      quiet = bookkeepingOnly(plan) ? quiet + 1 : 0;
      probes = probeOnly(plan) ? probes + 1 : 0;
      if (result.code === 'stale_observation' && ++stalePlans < 3) continue;
      if (result.error) {
        // Nothing reached the pad, so re-planning cannot compound a mistake and
        // the first-error pause has nothing to protect yet. A stale observation
        // is already bounded by stalePlans above and must not spend this budget
        // a second time.
        if (result.code !== 'stale_observation' && executor.inputs === batchInputs) {
          refine(result.error, 'No input reached the game and the scene is unchanged. Re-plan from this observation.');
          continue;
        }
        throw new Error(result.error);
      }
      stalePlans = 0;
      refines = 0;
    }
    throw new Error('800-decision run budget reached');
  } catch (error) {
    lifecycle = 'paused';
    requiresResume = true;
    await gateway.call({ op: 'pad-neutral' }, { timeoutMs: 3000 }).catch(() => {});
    let after = recentSensors.at(-1)?.state || lastState;
    let afterImage = null;
    try { after = JSON.parse((await gateway.call({ op: 'sts2-get', path: '/api/v1/singleplayer', query: { format: 'json' } })).body); } catch { }
    try { executionMetrics.screenshots++; afterImage = await gateway.call({ op: 'screenshot', format: 'jpeg' }); } catch { }
    const reason = String(error.message).replaceAll(process.env.ORCA_KEY || 'NO_KEY', '[redacted]').replace(/sk-(?:or-v1-)?[a-zA-Z0-9_-]{20,}/g, '[redacted]');
    if (!controller.signal.aborted) {
      const logFile = path.join(directory, 'events.jsonl');
      attention = saveIncident(directory, { decision, sessionId, error: reason, model: PROFILE.model, reasoning: PROFILE.reasoning, compatibility: build, before: observation, after, beforeImage, afterImage, plan, planner: planner.lastDiagnostics, lastResult, recentInputs, recentSensors, eventLogBytes: fs.existsSync(logFile) ? fs.statSync(logFile).size : 0 });
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
  const state = { state_type: 'menu', menu_screen: 'main' };
  const plan = await planner.decide({ task: 'Smoke test: choose a standalone wait action. No game is connected.', observation_id: stateId(state), state });
  validatePlan(plan, state);
  console.log(JSON.stringify({ smoke: 'passed', model: PROFILE.model, reasoning: PROFILE.reasoning, plan }));
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
