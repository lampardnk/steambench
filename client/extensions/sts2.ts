// Pi extension: Slay the Spire 2 sensors and virtual pad actuator.
//
// Every tool goes through the host process gateway. Game state is read-only
// (GET-only proxy to the STS2MCP mod); all gameplay input is a virtual Xbox
// pad. The vision helper sends a screenshot to a separate multimodal model
// and returns text, because the primary model is text-only.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { call, GatewayError } from "../gateway_client.js";

const VISION_MODEL = process.env.STEAMBENCH_VISION_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const VISION_URL = process.env.STEAMBENCH_VISION_URL || "https://openrouter.ai/api/v1/chat/completions";
const VISION_TIMEOUT_MS = 60000;
const MAX_BODY_CHARS = 60000;

const VISION_PROMPT = `You are describing one screenshot of the game Slay the Spire 2 for a text-only agent that plays it with a gamepad.
Report, in at most 12 short lines and without speculation:
1. Screen type (main menu, character select, map, combat, card reward, event, shop, rest site, popup/dialog, settings, loading, other).
2. Any dialog or popup text and the labels of its buttons.
3. Which element the gamepad cursor/highlight is on right now, if visible.
4. Visible cards in hand, enemies and their intents, and player HP/energy/gold, if this is combat.
5. Any error banner, warning, or "press a button" prompt.`;

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }], details: {} };
}

function truncate(body: string): string {
  if (body.length <= MAX_BODY_CHARS) return body;
  return `${body.slice(0, MAX_BODY_CHARS)}\n\n[truncated ${body.length - MAX_BODY_CHARS} characters]`;
}

function describe(error: unknown): string {
  if (error instanceof GatewayError) {
    const details = error.details ? ` ${JSON.stringify(error.details)}` : "";
    return `${error.code}: ${error.message}${details}`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function gateway(request: Record<string, unknown>, timeoutMs?: number) {
  try {
    return await call(request, { timeoutMs });
  } catch (error) {
    throw new Error(describe(error));
  }
}

async function sts2Get(path: string, query: Record<string, unknown> = {}) {
  const result = await gateway({ op: "sts2-get", path, query });
  return truncate(String(result.body ?? ""));
}

async function describeScreenshot(imageBase64: string, format: string, question: string | undefined, signal: AbortSignal | undefined) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set; sts2_look needs it for the vision model");
  const prompt = question ? `${VISION_PROMPT}\nThe agent also asks: ${question}` : VISION_PROMPT;
  const body = {
    model: VISION_MODEL,
    max_tokens: 600,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/${format};base64,${imageBase64}` } },
        ],
      },
    ],
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 3000));
    const signals = [AbortSignal.timeout(VISION_TIMEOUT_MS)];
    if (signal) signals.push(signal);
    try {
      const response = await fetch(VISION_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.any(signals),
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || response.statusText;
        lastError = new Error(`vision model HTTP ${response.status}: ${message}`);
        if (response.status === 429 || response.status >= 500) continue;
        throw lastError;
      }
      const content = payload?.choices?.[0]?.message?.content;
      const answer = typeof content === "string" ? content : Array.isArray(content) ? content.map((part: any) => part?.text || "").join("") : "";
      if (!answer.trim()) throw new Error("vision model returned an empty answer");
      return answer.trim();
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export default function sts2Extension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const note =
      "You are a steambench player connected to a Steam game through the sts2_* and pad_* tools. " +
      "Load the sts2 skill (read its SKILL.md) before acting, keep notes only in its scratchpad/ folder, " +
      "and call run_over exactly once when the run has ended.";
    return { systemPrompt: `${event.systemPrompt}\n\n${note}` };
  });

  const neutralize = async () => {
    try {
      await call({ op: "pad-neutral" }, { timeoutMs: 5000 });
    } catch {
      // Best effort: the gateway neutralizes on its own when a request fails.
    }
  };
  pi.on("session_shutdown", neutralize);
  pi.on("agent_end", neutralize);

  pi.registerCommand("sts2", {
    description: "Show STS2MCP reachability and virtual pad status",
    handler: async (_args, ctx) => {
      const lines: string[] = [];
      try {
        const hello = await gateway({ op: "sts2-get", path: "/" });
        lines.push(`STS2MCP: ${String(hello.body).trim()}`);
      } catch (error) {
        lines.push(`STS2MCP: ${describe(error)}`);
      }
      try {
        lines.push(`pad: ${JSON.stringify(await gateway({ op: "pad-status" }))}`);
      } catch (error) {
        lines.push(`pad: ${describe(error)}`);
      }
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // --- Sensors --------------------------------------------------------------

  pi.registerTool({
    name: "sts2_state",
    label: "STS2 state",
    description:
      "Read the current Slay the Spire 2 game state from the STS2MCP mod (read-only). The state_type field says which screen is active (menu, map, combat, card_reward, event, shop, rest_site, ...). Markdown is compact; use json only when you need exact indices.",
    promptSnippet: "Read the current STS2 game state (screen type, hand, enemies, map options)",
    promptGuidelines: ["Call sts2_state after every pad action before deciding the next one."],
    parameters: Type.Object({
      format: Type.Optional(StringEnum(["markdown", "json"] as const)),
      mode: Type.Optional(StringEnum(["singleplayer", "multiplayer"] as const)),
    }),
    async execute(_id, params) {
      const mode = params.mode ?? "singleplayer";
      return text(await sts2Get(`/api/v1/${mode}`, { format: params.format ?? "markdown" }));
    },
  });

  pi.registerTool({
    name: "sts2_profile",
    label: "STS2 profile",
    description: "Read the active profile's persistent progress summary: discoveries, achievements, character totals, run totals.",
    promptSnippet: "Read the active STS2 profile's progress summary",
    parameters: Type.Object({}),
    async execute() {
      return text(await sts2Get("/api/v1/profile"));
    },
  });

  pi.registerTool({
    name: "sts2_compendium",
    label: "STS2 compendium",
    description:
      "Read the Compendium-shaped progress summary (Card Library, Relic Collection, Potion Lab, Bestiary, Character Stats, Run History). Large; prefer sts2_wiki for a specific card or relic.",
    promptSnippet: "Read the STS2 compendium (card library, relics, bestiary, run history)",
    parameters: Type.Object({}),
    async execute() {
      return text(await sts2Get("/api/v1/compendium"));
    },
  });

  pi.registerTool({
    name: "sts2_wiki",
    label: "STS2 wiki search",
    description: "Fuzzy-search discovered card and relic wiki entries for the active profile (rules text, upgraded variants).",
    promptSnippet: "Look up a card or relic's rules text by approximate name",
    promptGuidelines: ["Use sts2_wiki when you need a card or relic's exact effect before playing or picking it."],
    parameters: Type.Object({
      query: Type.String({ description: "Approximate card or relic name, e.g. 'perfected strike'" }),
      item_type: Type.Optional(StringEnum(["all", "card", "relic"] as const)),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    }),
    async execute(_id, params) {
      const query: Record<string, unknown> = { query: params.query };
      if (params.item_type) query.item_type = params.item_type;
      if (params.limit) query.limit = params.limit;
      return text(await sts2Get("/api/v1/wiki", query));
    },
  });

  pi.registerTool({
    name: "sts2_profiles",
    label: "STS2 profiles",
    description: "List the three profile slots and which one is active (read-only).",
    promptSnippet: "List STS2 profile slots",
    parameters: Type.Object({}),
    async execute() {
      return text(await sts2Get("/api/v1/profiles"));
    },
  });

  pi.registerTool({
    name: "sts2_look",
    label: "STS2 look",
    description:
      "Take a screenshot of the game window and have a vision model describe it in text: screen type, dialog text and buttons, where the gamepad highlight is, error banners. Slower than sts2_state; use it when the state is ambiguous or did not change after input.",
    promptSnippet: "Describe the game screen from a screenshot (menus, popups, cursor position)",
    promptGuidelines: [
      "Use sts2_look only when sts2_state reports a menu/unknown state, a popup, or the state did not change after a pad action.",
    ],
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Optional specific question about the screen" })),
      width: Type.Optional(Type.Integer({ minimum: 320, maximum: 1920, description: "Screenshot width in pixels, default 1280" })),
    }),
    async execute(_id, params, signal) {
      const started = Date.now();
      const shot = await gateway({ op: "screenshot", width: params.width ?? 1280, format: "jpeg" }, 30000);
      const answer = await describeScreenshot(String(shot.data_base64), String(shot.format), params.question, signal);
      return {
        content: [{ type: "text" as const, text: answer }],
        details: { width: shot.width, height: shot.height, model: VISION_MODEL, latency_ms: Date.now() - started },
      };
    },
  });

  // --- Actuator: virtual Xbox pad ---------------------------------------------

  const padResult = (result: unknown) => text(`ok ${JSON.stringify(result)}`);

  pi.registerTool({
    name: "pad_press",
    label: "Pad press",
    description:
      "Press and release one gamepad button. a=confirm/select, b=cancel/back, x/y=context actions, lb/rb=tabs (deck, map), start=settings, back=view, lt/rt=triggers, ls/rs=stick clicks.",
    promptSnippet: "Press one gamepad button (a, b, x, y, lb, rb, back, start, guide, ls, rs, lt, rt)",
    promptGuidelines: ["Use pad_press a to confirm the highlighted element and pad_press b to cancel or go back."],
    parameters: Type.Object({
      button: StringEnum(["a", "b", "x", "y", "lb", "rb", "back", "start", "guide", "ls", "rs", "lt", "rt"] as const),
      hold_ms: Type.Optional(Type.Integer({ minimum: 30, maximum: 2000, description: "Hold duration, default 80" })),
    }),
    async execute(_id, params) {
      const request: Record<string, unknown> = { op: "pad-press", button: params.button };
      if (params.hold_ms) request.hold_ms = params.hold_ms;
      return padResult(await gateway(request));
    },
  });

  pi.registerTool({
    name: "pad_dpad",
    label: "Pad d-pad",
    description: "Tap the d-pad in one direction one or more times to move the highlight between cards, map nodes, menu entries, or targets.",
    promptSnippet: "Move the gamepad highlight with the d-pad (up/down/left/right, N presses)",
    promptGuidelines: ["Use pad_dpad to move the highlight, then sts2_state or sts2_look to confirm what is selected before pressing a."],
    parameters: Type.Object({
      direction: StringEnum(["up", "down", "left", "right"] as const),
      presses: Type.Optional(Type.Integer({ minimum: 1, maximum: 20, description: "Number of taps, default 1" })),
      interval_ms: Type.Optional(Type.Integer({ minimum: 40, maximum: 500, description: "Delay between taps, default 120" })),
    }),
    async execute(_id, params) {
      const request: Record<string, unknown> = { op: "pad-dpad", direction: params.direction };
      if (params.presses) request.presses = params.presses;
      if (params.interval_ms) request.interval_ms = params.interval_ms;
      return padResult(await gateway(request));
    },
  });

  pi.registerTool({
    name: "pad_stick",
    label: "Pad stick",
    description: "Push an analog stick toward (x, y) for a short hold, then recenter. x: -1 left .. 1 right; y: -1 up .. 1 down. Useful for aiming a card at a target when the d-pad does not move the highlight.",
    promptSnippet: "Push the left or right analog stick toward a direction briefly",
    parameters: Type.Object({
      stick: StringEnum(["left", "right"] as const),
      x: Type.Number({ minimum: -1, maximum: 1 }),
      y: Type.Number({ minimum: -1, maximum: 1 }),
      hold_ms: Type.Optional(Type.Integer({ minimum: 30, maximum: 2000, description: "Hold duration, default 80" })),
    }),
    async execute(_id, params) {
      const request: Record<string, unknown> = { op: "pad-stick", stick: params.stick, x: params.x, y: params.y };
      if (params.hold_ms) request.hold_ms = params.hold_ms;
      return padResult(await gateway(request));
    },
  });

  pi.registerTool({
    name: "pad_neutral",
    label: "Pad neutral",
    description: "Release every button and recenter every axis on the virtual pad.",
    promptSnippet: "Release all gamepad input",
    parameters: Type.Object({}),
    async execute() {
      return padResult(await gateway({ op: "pad-neutral" }));
    },
  });

  pi.registerTool({
    name: "pad_status",
    label: "Pad status",
    description:
      "Report the virtual pad: device path, currently held inputs, whether another process (Steam) has grabbed it, and which game processes are reading it. If readers is empty the game is not seeing the pad.",
    promptSnippet: "Check that the virtual gamepad exists and the game is reading it",
    promptGuidelines: ["Use pad_status if pad actions seem to have no effect."],
    parameters: Type.Object({}),
    async execute() {
      return text(JSON.stringify(await gateway({ op: "pad-status" }), null, 2));
    },
  });

  pi.registerTool({
    name: "run_over",
    label: "Run over",
    description:
      "Report that the run has ended (the character died, the Spire was beaten, or the game cannot continue). Call it exactly once; steambench then archives the room and shuts it down.",
    promptSnippet: "Report the end of the run (won or lost) with a short summary",
    parameters: Type.Object({
      result: StringEnum(["lost", "won", "aborted"] as const),
      summary: Type.String({ description: "Two or three sentences: how far you got, what killed you or how you won, key lessons." }),
    }),
    async execute(params) {
      const result = await gateway({ op: "room-finish", result: params.result, summary: params.summary });
      return text(`recorded: ${JSON.stringify(result)}`);
    },
  });
}
