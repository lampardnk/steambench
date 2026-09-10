#!/usr/bin/env node
const readline = require('node:readline');
const fs = require('node:fs');
readline.createInterface({ input: process.stdin }).on('line', line => {
  const command = JSON.parse(line);
  const context = JSON.parse(command.message);
  // The role is the prompt id, so the calls file records who asked as well as how often.
  fs.appendFileSync(process.env.FIXTURE_CALLS, `${command.id}\n`);
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
  // Who is asking is visible in the context itself: only the actuator is sent
  // the element list, and only the play agents are sent a game state.
  const actuating = Array.isArray(context.elements);
  // The encounter agent's closing report: six bounded fields, no plan.
  if (context.runtime_outcome !== undefined) {
    const report = { outcome: context.runtime_outcome, hp_cost: 7, worked: 'Blocking the published attack cost nothing.', struggled: null, deck_need: 'The deck has no answer to two enemies at once.', enemy_note: 'Fogmog alternates a 9 attack with a block.' };
    console.log(JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(report) }], stopReason: 'stop' } }));
    console.log(JSON.stringify({ type: 'agent_settled' }));
    return;
  }
  if (mode === 'delegated_goal' && !actuating) {
    const reference = context.retrieved_notes?.find(note => note.path === 'fixture-reference.md');
    fs.writeFileSync(`${process.env.FIXTURE_CALLS}.references`, reference?.content?.endsWith('END_OF_REFERENCE') ? 'complete' : 'missing');
  }
  if (!actuating) {
    // A play agent says what it wants; it is shown no control to press. In a
    // fight it names cards instead, because it is dealt a hand and not a screen.
    const goal = context.state && context.state.battle
      ? { observation: context.observation_id, summary: 'Fixture turn', note: 'End the fixture turn.', actions: [{ type: 'end_turn' }] }
      : { observation: context.observation_id, summary: 'Fixture goal', note: 'State the goal; the actuator finds the control.', actions: [{ type: 'intent', goal: 'leave this screen', target_label: 'Leave' }] };
    console.log(JSON.stringify({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: JSON.stringify(goal) } }));
    console.log(JSON.stringify({ type: 'message_end', message: { role: 'assistant', stopReason: 'stop', model: 'fixture', usage: { input: 10, output: 10, totalTokens: 20 } } }));
    console.log(JSON.stringify({ type: 'agent_settled' }));
    return;
  }
  const actions = mode === 'report' ? [{ type: 'report_issue', issue: 'Unknown fixture interaction; please inspect before further input.' }]
    : mode === 'probes_only' ? [{ type: 'input', buttons: ['right'] }]
    : mode === 'notes_only' ? [{ type: 'learn', path: `ironclad/a1/controls/fixture-${context.consecutive_notes_without_acting}.md`, content: '---\ndescription: fixture\nkeys: fixture\n---\nObserved.\n', message: 'Record a fixture observation' }]
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
