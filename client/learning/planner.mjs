import fs from 'node:fs';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { PROFILE } from './profile.mjs';

/**
 * The plan object out of a model response. A complete, correct plan arrived
 * wrapped in a sentence of prose - "Fighting the elite at 30 HP: block first...\n\n{...}" -
 * and was rejected three times in a row, which ends a room. The JSON is right
 * there; take it. Only a genuinely unparseable response is an error, and it
 * still reports the original parse failure rather than this fallback's.
 */
export function parsePlanText(text) {
  const object = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);
  let direct = null;
  try { direct = object(JSON.parse(text)); }
  catch { direct = null; }
  if (direct) return direct;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const recovered = object(JSON.parse(text.slice(first, last + 1)));
      if (recovered) return recovered;
    } catch { /* fall through to the original failure */ }
  }
  // Reported as the plain parse failure the caller already knows how to refine.
  JSON.parse(text);
  throw new Error('response is valid JSON but not a plan object');
}

export class Planner {
  constructor({ emit, record }) {
    this.emit = emit;
    this.record = record;
  }

  /**
   * One model call with its own system prompt, in one member's lane.
   *
   * Every role on the team - strategist, combat, actuator, curriculum, critic -
   * comes through here, so token usage is recorded the same way for all of them
   * and the dashboard can file each response under whoever produced it. `agent`
   * is the lane id, which for the encounter agents changes every fight while
   * `role` stays 'combat'. `primary` marks the call that owns the pad-facing
   * decision: it streams its thinking, keeps diagnostics for the incident
   * record, and is the one an operator abort interrupts.
   */
  ask({ role, agent = role, prompt: promptFile, context, image = null, stream = false, primary = stream, deadlineMs = PROFILE.plannerDeadlineMs }) {
    if (primary) this.lastDiagnostics = null;
    if (!process.env[PROFILE.apiKeyEnv]) throw new Error(`${PROFILE.apiKeyEnv} is required`);
    const prompt = fs.readFileSync(new URL(`./${promptFile}`, import.meta.url), 'utf8');
    return new Promise((resolve, reject) => {
      const child = spawn('pi', ['--mode', 'rpc', '--no-session', '--provider', PROFILE.provider, '--model', PROFILE.model, ...(PROFILE.reasoning && PROFILE.reasoning !== 'default' ? ['--thinking', PROFILE.reasoning] : []), '--no-tools', '--no-extensions', '--no-skills', '--no-context-files', '--no-prompt-templates', '--offline', '--system-prompt', prompt], { stdio: ['pipe', 'pipe', 'pipe'] });
      if (primary) this.child = child;
      let answer = '';
      let stderr = '';
      let finished = false;
      let assistant = null;
      const events = { messages: 0, textChunks: 0, thinkingCharacters: 0 };
      const started = Date.now();
      const timer = setTimeout(() => finish(new Error(`${role} exceeded ${deadlineMs / 1000}-second deadline`)), deadlineMs);
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        child.kill('SIGTERM');
        if (primary) { this.child = null; this.cancel = null; }
        const diagnostics = { assistant, events, responseText: answer.slice(0, 12000), stderr: stderr.slice(-1500), latencyMs: Date.now() - started };
        const fail = failure => {
          if (primary) this.lastDiagnostics = diagnostics;
          this.record({ type: 'planner_response_failure', role, agent, error: failure.message, ...diagnostics });
          reject(failure);
        };
        if (error) return fail(error);
        try {
          const clean = answer.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
          if (!clean) throw new Error(`empty ${role} response: ${events.messages} assistant messages, ${events.textChunks} text chunks, stop reason ${assistant?.stopReason || 'missing'}`);
          if (clean.length > 12000) throw new Error(`${role} output exceeds limit`);
          resolve(parsePlanText(clean));
        } catch (error) { fail(error); }
      };
      if (primary) this.cancel = () => finish(new Error('planner aborted'));
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1500); });
      child.on('error', finish);
      child.on('close', code => { if (!finished) finish(new Error(`Pi exited ${code}: ${stderr}`)); });
      child.stdin.on('error', finish);
      const lines = readline.createInterface({ input: child.stdout });
      lines.on('line', line => {
        let event;
        try { event = JSON.parse(line); } catch { return; }
        if (event.type === 'response' && event.success === false) return finish(new Error(event.error || 'Pi rejected prompt'));
        if (event.type === 'message_update') {
          const update = event.assistantMessageEvent;
          if (update?.type === 'text_delta') { answer += update.delta; events.textChunks++; }
          if (update?.type === 'thinking_delta') events.thinkingCharacters += update.delta?.length || 0;
          if (stream && ['text_delta', 'thinking_delta', 'thinking_end'].includes(update?.type)) this.emit({ ...event, agent });
        }
        if (event.type === 'message_end' && event.message?.role === 'assistant') {
          events.messages++;
          const message = event.message;
          assistant = { model: message.model, provider: message.provider, responseId: message.responseId, stopReason: message.stopReason, contentTypes: message.content?.map(part => part.type), usage: message.usage };
          const finalText = message.content?.filter(part => part.type === 'text').map(part => part.text).join('');
          if (finalText) answer = finalText;
          this.record({ type: 'model_usage', role, agent, model: event.message.model, usage: event.message.usage, stopReason: event.message.stopReason, latencyMs: Date.now() - started });
          if (event.message.stopReason === 'error' || event.message.stopReason === 'aborted') return finish(new Error(event.message.errorMessage || 'model failed'));
        }
        if (event.type === 'agent_settled') finish();
      });
      child.stdin.write(JSON.stringify({ type: 'prompt', id: role, message: JSON.stringify(context), ...(image ? { images: [{ type: 'image', data: image.data_base64, mimeType: image.mime_type || 'image/jpeg' }] } : {}) }) + '\n');
    });
  }

  async abort() { this.cancel?.(); }
}
