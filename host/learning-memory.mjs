import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { VERSION, digest } from '../client/learning/state.mjs';
import { acceptedLessons } from '../client/learning/memory.mjs';

const { positionals, values } = parseArgs({ allowPositionals: true, options: { review: { type: 'string' }, evaluation: { type: 'string' }, text: { type: 'string' } } });
const [command, ...argumentsList] = positionals;

async function scan(directory, visit) {
  const lines = readline.createInterface({ input: fs.createReadStream(path.join(directory, 'events.jsonl')), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim()) visit(JSON.parse(line));
  }
}

async function report(directory) {
  const metrics = JSON.parse(fs.readFileSync(path.join(directory, 'metrics.json')));
  const latencies = [];
  const contexts = [];
  const floors = new Set();
  let failureEvents = 0;
  let confirmedPlays = 0;
  let pause = null;
  await scan(directory, event => {
    if (event.type === 'model_usage') latencies.push(event.latencyMs);
    if (event.type === 'decision_context') contexts.push(event.characters);
    if (event.type === 'observation' && event.state?.run) floors.add(`${event.state.run.act}:${event.state.run.floor}`);
    if (event.type === 'action_failure' || event.type === 'planner_failure') failureEvents++;
    if (event.type === 'action' && event.action?.type === 'play' && event.verified) confirmedPlays++;
    if (event.type === 'paused') pause = event.error;
  });
  latencies.sort((left, right) => left - right);
  const percentile = fraction => latencies.length ? latencies[Math.ceil(latencies.length * fraction) - 1] : null;
  return { directory, ...metrics, observedFloors: floors.size, tokensPerObservedFloor: floors.size ? Math.round((metrics.usage?.totalTokens || 0) / floors.size) : null, recordedConfirmedPlays: confirmedPlays, recordedFailureEvents: failureEvents, modelLatencyP50Ms: percentile(0.5), modelLatencyP95Ms: percentile(0.95), maxContextCharacters: contexts.length ? Math.max(...contexts) : null, lastPause: pause };
}

async function review(directory, candidateId, output) {
  if (!directory || !candidateId || !output || !values.review?.trim() || !values.evaluation?.trim()) throw new Error('review requires SCRATCHPAD CANDIDATE_ID OUTPUT --review "rationale" --evaluation "held-out run references and result"');
  const candidates = fs.readFileSync(path.join(directory, 'candidates.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const candidate = candidates.find(item => item.id === candidateId);
  if (!candidate || candidate.version !== VERSION || !candidate.compatibility?.game || !candidate.compatibility?.mod || !candidate.compatibility?.policy) throw new Error('candidate missing or lacks compatible build provenance');
  if (candidate.error) throw new Error('candidate execution failed; inspect evidence rather than promoting it');
  let evidence;
  await scan(directory, event => {
    if (event.type === 'decision_result' && event.decision === candidate.decision && event.plan?.lesson === candidate.text) evidence = event;
  });
  if (!evidence || evidence.error || !evidence.completed?.some(action => action.verified)) throw new Error('candidate lacks a matching successful, verified decision result');
  const text = (values.text || candidate.text).trim();
  if (!text || text.length > 500) throw new Error('reviewed lesson must contain 1–500 characters; use --text to edit it');
  const seed = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output)) : { version: VERSION, compatibility: candidate.compatibility, lessons: [] };
  if (seed.version !== VERSION || digest(seed.compatibility) !== digest(candidate.compatibility) || !Array.isArray(seed.lessons)) throw new Error('output has incompatible memory; choose a separate file');
  const lesson = { status: 'accepted', text, review: values.review, evaluation: values.evaluation, reviewedAt: new Date().toISOString(), evidence: [{ run: path.basename(path.dirname(path.resolve(directory))), candidate: candidateId, decision: candidate.decision, resultHash: digest(evidence) }] };
  seed.lessons = [...seed.lessons.filter(item => item.text !== text), lesson];
  if (seed.lessons.length > 8 || acceptedLessons(seed, candidate.compatibility).length !== seed.lessons.length) throw new Error('memory exceeds eight lessons or contains invalid entries');
  const content = JSON.stringify(seed, null, 2) + '\n';
  if (Buffer.byteLength(content) > 12000) throw new Error('memory exceeds 12 KB');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content, { mode: 0o600 });
  fs.renameSync(temporary, output);
  console.log(JSON.stringify({ saved: output, lessons: seed.lessons.length, memoryHash: digest(seed), note: 'Human-reviewed hypothesis; evidence checks do not prove causal improvement. Existing rooms remain unchanged.' }));
}

try {
  if (command === 'report' && argumentsList.length) {
    for (const directory of argumentsList) console.log(JSON.stringify(await report(directory), null, 2));
  } else if (command === 'review') await review(...argumentsList);
  else throw new Error('Usage: node host/learning-memory.mjs report SCRATCHPAD... | review SCRATCHPAD CANDIDATE_ID OUTPUT --review TEXT --evaluation TEXT [--text TEXT]');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
