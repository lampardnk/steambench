// Exact contract for the STS2MCP single-player mutation endpoint. Keep this
// deliberately smaller than the mod's request parser: an agent may send only
// documented actions and fields, with bounded values.

const INDEX = { type: 'integer', min: 0, max: 10000 };
const TARGET = { type: 'string', minLength: 1, maxLength: 160, optional: true };

export const STS2_ACTION_SCHEMAS = Object.freeze({
  menu_select: { option: { type: 'string', minLength: 1, maxLength: 160 }, seed: { type: 'string', minLength: 1, maxLength: 160, optional: true } },
  play_card: { card_index: INDEX, target: TARGET },
  use_potion: { slot: INDEX, target: TARGET },
  discard_potion: { slot: INDEX },
  end_turn: {},
  combat_select_card: { card_index: INDEX },
  combat_confirm_selection: {},
  claim_reward: { index: INDEX },
  select_card_reward: { card_index: INDEX },
  skip_card_reward: {},
  proceed: {},
  shop_back: {},
  choose_event_option: { index: INDEX },
  advance_dialogue: {},
  choose_rest_option: { index: INDEX },
  shop_purchase: { index: INDEX },
  choose_map_node: { index: INDEX },
  select_card: { index: INDEX },
  confirm_selection: {},
  cancel_selection: {},
  select_bundle: { index: INDEX },
  confirm_bundle_selection: {},
  cancel_bundle_selection: {},
  select_relic: { index: INDEX },
  skip_relic_selection: {},
  claim_treasure_relic: { index: INDEX },
  crystal_sphere_set_tool: { tool: { type: 'enum', values: ['big', 'small'] } },
  crystal_sphere_click_cell: { x: INDEX, y: INDEX },
  crystal_sphere_proceed: {},
});

export function validateSts2Action(action, params) {
  if (typeof action !== 'string' || !(action in STS2_ACTION_SCHEMAS)) {
    const error = new Error('action is not allowlisted');
    error.code = 'invalid_action';
    error.details = { allowed: Object.keys(STS2_ACTION_SCHEMAS) };
    throw error;
  }
  if (params === undefined) params = {};
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw actionError('invalid_params', 'params must be an object');
  const schema = STS2_ACTION_SCHEMAS[action];
  for (const key of Object.keys(params)) if (!(key in schema)) throw actionError('invalid_params', `parameter not allowed for ${action}: ${key}`, { allowed: Object.keys(schema) });
  const clean = {};
  for (const [key, rule] of Object.entries(schema)) {
    const value = params[key];
    if (value === undefined) {
      if (!rule.optional) throw actionError('invalid_params', `${action}.${key} is required`);
      continue;
    }
    if (rule.type === 'integer' && (!Number.isInteger(value) || value < rule.min || value > rule.max)) throw actionError('invalid_params', `${action}.${key} must be an integer from ${rule.min} to ${rule.max}`);
    if (rule.type === 'string' && (typeof value !== 'string' || value.length < rule.minLength || value.length > rule.maxLength)) throw actionError('invalid_params', `${action}.${key} must be a ${rule.minLength}-${rule.maxLength} character string`);
    if (rule.type === 'enum' && !rule.values.includes(value)) throw actionError('invalid_params', `${action}.${key} must be one of ${rule.values.join(', ')}`);
    clean[key] = value;
  }
  return clean;
}

function actionError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}
