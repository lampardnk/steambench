import { noul, choice } from './systemone.mjs';

/**
 * Many cheap judgements, condensed into one decision.
 *
 * A flat Choice asks the model to weigh every consideration at once, which is
 * the one thing a System One model is not built for. The cascade splits that:
 * layer 1 asks one atomic yes/no per option per aspect - all in a single call,
 * because the model prices only its input and answering twelve questions costs
 * what answering one costs - and layer 2 decides over the answers.
 *
 * Measured on 15 real card-reward decisions from run 2026-09-12, scored
 * against what the strategist actually picked: a flat Choice on thin context
 * agreed 6/15, a flat Choice on rich context 8/15, and this cascade 9/15. The
 * same layer-1 readings combined by a hand-weighted sum in code managed 6/15,
 * which is why layer 2 is a model call and not a formula.
 *
 * It is not free improvement, and it is not universal: on map navigation,
 * where there is nothing to compose, the cascade scored 10/13 against a flat
 * Choice's 11/13. Use it where a decision has several independent dimensions,
 * and use `flatChoice` where it does not.
 */

/**
 * A probability, as words.
 *
 * Layer 2 never sees a number. Jev is documented as unreliable at arithmetic -
 * it "does not count reliably" and its score levels are "weak in numerical
 * calibration" - so handing it floats to compare would be asking for exactly
 * the failure the vendor warns about. Code does the thresholding; the model
 * reads a phrase.
 */
export function bucket(value) {
  if (!Number.isFinite(value)) return 'not assessed';
  if (value >= 0.85) return 'almost certainly yes';
  if (value >= 0.6) return 'probably yes';
  if (value >= 0.4) return 'unclear';
  if (value >= 0.15) return 'probably no';
  return 'almost certainly no';
}

/** Choice criteria keys must be strings; callers keep the original ids. */
const keyOf = (id) => String(id);

/**
 * Build the option table a Choice question needs.
 *
 * The keys are the identities the screen itself published, so whatever comes
 * back is an identity the executor can already resolve. This is what makes the
 * whole "unknown reward / unknown shop item" rejection class impossible here:
 * the model cannot name something it was not handed.
 */
export function optionCriteria(options, { id, describe }) {
  return Object.fromEntries(options.map(option => [keyOf(id(option)), String(describe(option)).slice(0, 220)]));
}

/** One yes/no per option per aspect, in a single request. */
export function aspectQuestions(options, aspects, { id, name }) {
  const questions = {};
  for (const option of options) {
    const key = keyOf(id(option));
    for (const [aspect, statement] of Object.entries(aspects)) {
      questions[`${key}::${aspect}`] = noul(`Considering "${name(option)}" among the listed options, judged against this exact situation: ${statement}`);
    }
  }
  return questions;
}

/** Turn layer-1 answers into the phrase table layer 2 reads. */
export function readAspects(answers, options, aspects, { id, name }) {
  return options.map(option => {
    const key = keyOf(id(option));
    const row = { option: name(option) };
    for (const aspect of Object.keys(aspects)) row[aspect] = bucket(answers[`${key}::${aspect}`]?.noul);
    return row;
  });
}

const pick = (answer, options, id) => {
  const chosen = options.find(option => keyOf(id(option)) === answer?.choice);
  return { option: chosen ?? null, id: chosen ? id(chosen) : null, confidence: answer?.confidence ?? 0, probabilities: answer?.probabilities || {} };
};

/**
 * One Choice over the published options. Use where the decision is simple.
 *
 * `state` should be narrow and rich at once: the things the decision turns on,
 * named, and nothing else. Accuracy falls as unrelated detail grows, and on
 * card rewards simply giving the call the deck by name and the relics with
 * their text moved it from 6/15 to 8/15.
 */
export async function flatChoice({ systemOne, state, options, id, describe, instructions, agent, role }) {
  const { answers, latencyMs } = await systemOne.ask({
    state, agent, role,
    questions: { pick: choice(instructions, optionCriteria(options, { id, describe })) },
  });
  return { ...pick(answers.pick, options, id), latencyMs, digest: null };
}

/**
 * Layer 1 then layer 2. Use where a decision has independent dimensions.
 *
 * Returns the bucketed digest alongside the pick, because on some surfaces the
 * reading is worth more than the choice: where confidence is not calibrated,
 * the caller shows the digest to the planner as evidence rather than acting on
 * the pick.
 */
export async function cascade({ systemOne, state, situation, options, id, name, describe, aspects, instructions, guidance, agent, role }) {
  const first = await systemOne.ask({
    state, agent, role,
    questions: aspectQuestions(options, aspects, { id, name }),
  });
  const digest = readAspects(first.answers, options, aspects, { id, name });
  const second = await systemOne.ask({
    agent, role,
    state: {
      situation,
      assessments: digest,
      guidance: guidance || 'Each assessment was produced by evaluating that one option against this exact situation. Decide from the assessments.',
    },
    questions: { pick: choice(instructions, optionCriteria(options, { id, describe })) },
  });
  return { ...pick(second.answers.pick, options, id), digest, latencyMs: first.latencyMs + second.latencyMs };
}
