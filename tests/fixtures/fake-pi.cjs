#!/usr/bin/env node
const readline = require('node:readline');
const fs = require('node:fs');
readline.createInterface({ input: process.stdin }).on('line', line => {
  const command = JSON.parse(line);
  const context = JSON.parse(command.message);
  fs.appendFileSync(process.env.FIXTURE_CALLS, 'plan\n');
  const mode = process.env.FIXTURE_MODE;
  if (mode === 'provider_error') {
    console.log(JSON.stringify({ type: 'message_end', message: { role: 'assistant', stopReason: 'error', errorMessage: 'fixture provider unavailable' } }));
    return;
  }
  if (mode === 'empty') {
    console.log(JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [], stopReason: 'stop', usage: { totalTokens: 0 } } }));
    console.log(JSON.stringify({ type: 'agent_settled' }));
    return;
  }
  const actions = mode === 'report' ? [{ type: 'report_issue', issue: 'Unknown fixture interaction; please inspect before further input.' }]
    : mode === 'notes_only' ? [{ type: 'learn', path: `controls/fixture-${context.consecutive_notes_without_acting}.md`, content: '---\ndescription: fixture\nkeys: fixture\n---\nObserved.\n', message: 'Record a fixture observation' }]
    : [{ type: 'input', buttons: ['a'] }];
  const plan = { observation: context.observation_id, summary: 'Fixture decision', actions, note: 'Observed fixture focus; test one known A input or report uncertainty.' };
  if (mode === 'final_only') {
    console.log(JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(plan) }], stopReason: 'stop' } }));
    console.log(JSON.stringify({ type: 'agent_settled' }));
    return;
  }
  console.log(JSON.stringify({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: JSON.stringify(plan) } }));
  console.log(JSON.stringify({ type: 'message_end', message: { role: 'assistant', stopReason: 'stop', model: 'fixture', usage: { input: 10, output: 10, totalTokens: 20 } } }));
  console.log(JSON.stringify({ type: 'agent_settled' }));
});
