// Bounded web reference lookups for the player. The bundled references.json is
// a small hand-picked extract; a run meets enemies, events and cards it has no
// entry for. This fetches those pages on demand from an allowlist, converts
// them to plain text and hands back a bounded excerpt.
//
// Players are not given general internet access: the server performs the
// request, only these hosts are reachable, and nothing the page says is treated
// as an instruction. Live mod state always outranks a fetched page.
import { GatewayError } from './gateway.js';

// One reference site, one version. slaythespire2.net serves several game
// versions from the same paths, so every fetch is pinned to the beta profile
// that matches the installed build; anything else would quietly describe a
// different game.
export const WEB_ALLOWLIST = ['slaythespire2.net', 'www.slaythespire2.net'];
export const REFERENCE_VERSION = 'beta';
export const INSTALLED_BUILD = 'v0.111.0';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 12000;
const TIMEOUT_MS = 15000;

const cache = new Map(); // url -> { at, result }
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 200;

/** Strip markup to readable text without pulling in a parser dependency. */
export function htmlToText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|table|ul|ol|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n').map(line => line.trim()).join('\n')
    .trim();
}

function checkUrl(raw) {
  let url;
  try { url = new URL(String(raw)); }
  catch { throw new GatewayError('invalid_url', 'url must be an absolute http(s) URL'); }
  if (url.protocol !== 'https:') throw new GatewayError('invalid_url', 'only https URLs are fetched');
  if (!WEB_ALLOWLIST.includes(url.hostname)) throw new GatewayError('host_not_allowed', `only https://slaythespire2.net/?v=${REFERENCE_VERSION} pages are reachable`, { allowed: WEB_ALLOWLIST });
  if (url.href.length > 400) throw new GatewayError('invalid_url', 'url is too long');
  const version = url.searchParams.get('v');
  if (version && version !== REFERENCE_VERSION) throw new GatewayError('wrong_version', `only the ${REFERENCE_VERSION} profile is allowed; it is the one matching the installed ${INSTALLED_BUILD} build`);
  url.searchParams.set('v', REFERENCE_VERSION);
  return url;
}

/**
 * Fetch one reference page as text, pinned to the beta profile. Repeated lookups
 * inside a run are served from a short-lived cache so a retry does not hammer
 * the site.
 */
export async function webGet(request) {
  const url = checkUrl(request?.url);
  const cached = cache.get(url.href);
  if (cached && Date.now() - cached.at < CACHE_MS) return { ...cached.result, cached: true };

  let response;
  try {
    response = await fetch(url.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'steambench-player/1.0 (game reference lookup)', Accept: 'text/html,text/plain' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new GatewayError('web_unavailable', `could not reach ${url.hostname} (${e.cause?.code || e.name})`);
  }
  if (!response.ok) throw new GatewayError('web_status', `${url.hostname} returned HTTP ${response.status}`, { status: response.status });
  const type = response.headers.get('content-type') || '';
  if (!/text\/html|text\/plain|application\/json/.test(type)) throw new GatewayError('web_type', `unsupported content type: ${type.split(';')[0] || 'unknown'}`);
  const raw = await response.text();
  if (raw.length > MAX_BYTES) throw new GatewayError('web_too_large', 'page exceeds 2 MiB');

  const text = /json/.test(type) ? raw : htmlToText(raw);
  const result = {
    url: response.url || url.href,
    host: url.hostname,
    retrieved: new Date().toISOString().slice(0, 10),
    truncated: text.length > MAX_TEXT,
    provenance: `${url.hostname} ?v=${REFERENCE_VERSION}; community reference for the installed ${INSTALLED_BUILD} build, which it can still lag. Live mod state overrides it.`,
    text: text.slice(0, MAX_TEXT),
  };
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(url.href, { at: Date.now(), result });
  return { ...result, cached: false };
}
