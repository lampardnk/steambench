import fs from 'node:fs';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { PROFILE } from './profile.mjs';

export class Planner {
  constructor({ emit, record }) {
    this.emit = emit;
    this.record = record;
  }

  decide(context, image) {
    this.lastDiagnostics = null;
    if (!process.env[PROFILE.apiKeyEnv]) throw new Error(`${PROFILE.apiKeyEnv} is required`);
    const prompt = fs.readFileSync(new URL('./prompt.txt', import.meta.url), 'utf8');
    return new Promise((resolve, reject) => {
      const child = spawn('pi', ['--mode', 'rpc', '--no-session', '--provider', PROFILE.provider, '--model', PROFILE.model, '--thinking', PROFILE.reasoning, '--no-tools', '--no-extensions', '--no-skills', '--no-context-files', '--no-prompt-templates', '--offline', '--system-prompt', prompt], { stdio: ['pipe', 'pipe', 'pipe'] });
      this.child = child;
      let answer = '';
      let stderr = '';
      let finished = false;
      let assistant = null;
      const events = { messages: 0, textChunks: 0, thinkingCharacters: 0 };
      const started = Date.now();
      const timer = setTimeout(() => finish(new Error(`planner exceeded ${PROFILE.plannerDeadlineMs / 1000}-second deadline`)), PROFILE.plannerDeadlineMs);
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        child.kill('SIGTERM');
        this.child = null;
        this.cancel = null;
        const diagnostics = { assistant, events, responseText: answer.slice(0, 12000), stderr: stderr.slice(-1500), latencyMs: Date.now() - started };
        const fail = failure => {
          this.lastDiagnostics = diagnostics;
          this.record({ type: 'planner_response_failure', error: failure.message, ...diagnostics });
          reject(failure);
        };
        if (error) return fail(error);
        try {
          const clean = answer.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
          if (!clean) throw new Error(`empty planner response: ${events.messages} assistant messages, ${events.textChunks} text chunks, stop reason ${assistant?.stopReason || 'missing'}`);
          if (clean.length > 12000) throw new Error('planner output exceeds limit');
          resolve(JSON.parse(clean));
        } catch (error) { fail(error); }
      };
      this.cancel = () => finish(new Error('planner aborted'));
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
          if (update?.type === 'thinking_delta' || update?.type === 'thinking_end') this.emit(event);
        }
        if (event.type === 'message_end' && event.message?.role === 'assistant') {
          events.messages++;
          const message = event.message;
          assistant = { model: message.model, provider: message.provider, responseId: message.responseId, stopReason: message.stopReason, contentTypes: message.content?.map(part => part.type), usage: message.usage };
          const finalText = message.content?.filter(part => part.type === 'text').map(part => part.text).join('');
          if (finalText) answer = finalText;
          this.record({ type: 'model_usage', model: event.message.model, usage: event.message.usage, stopReason: event.message.stopReason, latencyMs: Date.now() - started });
          if (event.message.stopReason === 'error' || event.message.stopReason === 'aborted') return finish(new Error(event.message.errorMessage || 'model failed'));
        }
        if (event.type === 'agent_settled') finish();
      });
      child.stdin.write(JSON.stringify({ type: 'prompt', id: 'decision', message: JSON.stringify(context), ...(image ? { images: [{ type: 'image', data: image.data_base64, mimeType: 'image/jpeg' }] } : {}) }) + '\n');
    });
  }

  async abort() { this.cancel?.(); }
}
