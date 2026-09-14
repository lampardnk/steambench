// Bounded web reference lookups for the player. Nothing is bundled with the
// image, and a run meets enemies, events and cards the mod does not describe.
// This fetches those pages on demand from an allowlist, converts them to plain
// text and hands back a bounded excerpt.
//
// Players are not given general internet access: the server performs the
// request, only these hosts are reachable, and nothing the page says is treated
// as an instruction. Live mod state always outranks a fetched page.
import { GatewayError } from './gateway.js';
import deadlines from './gateway-deadlines.cjs';

// Reference sites: slaythespire2.net and slaythespire.wiki.gg.
// slaythespire2.net serves several game versions from the same paths, so fetches to it
// are pinned to the beta profile that matches the installed build.
export const WEB_ALLOWLIST = ['slaythespire2.net', 'slaythespire.wiki.gg'];
export const REFERENCE_VERSION = 'beta';
export const INSTALLED_BUILD = 'v0.111.0';
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_TEXT = 12000;
export const TIMEOUT_MS = deadlines.INNER_OPERATION_TIMEOUTS_MS['web-get'];

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

function tooLarge(maximum = MAX_BYTES) {
  return new GatewayError('web_too_large', `page exceeds ${maximum} bytes`);
}

/**
 * Read a fetch response without ever buffering more than the configured byte
 * limit. The test-only text() fallback is retained for minimal Response-like
 * objects, but real fetch responses take the streaming path.
 */
export async function readBoundedResponse(response, maximum = MAX_BYTES, signal) {
  const body = response?.body;
  if (body?.getReader) {
    const reader = body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        if (signal?.aborted) throw signal.reason || new Error('response read was aborted');
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        bytes += chunk.byteLength;
        if (bytes > maximum) {
          await reader.cancel().catch(() => {});
          throw tooLarge(maximum);
        }
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, bytes).toString('utf8');
    } finally {
      reader.releaseLock?.();
    }
  }

  // Some test doubles and older fetch implementations expose a Node stream
  // rather than a WHATWG reader. Keep the same bound for that shape too.
  if (body && typeof body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let bytes = 0;
    for await (const value of body) {
      if (signal?.aborted) throw signal.reason || new Error('response read was aborted');
      const chunk = Buffer.from(value);
      bytes += chunk.byteLength;
      if (bytes > maximum) {
        body.destroy?.();
        throw tooLarge(maximum);
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, bytes).toString('utf8');
  }

  if (typeof response?.text !== 'function') throw new Error('response has no readable body');
  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > maximum) throw tooLarge(maximum);
  return raw;
}

function combinedSignal(externalSignal, timeoutSignal) {
  if (!externalSignal) return timeoutSignal;
  if (externalSignal.aborted) return externalSignal;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([externalSignal, timeoutSignal]);
  // Node versions without AbortSignal.any are still supported by forwarding
  // both abort events into a local controller.
  const controller = new AbortController();
  const abort = (event) => controller.abort(event?.target?.reason || new Error('web request aborted'));
  externalSignal.addEventListener('abort', abort, { once: true });
  timeoutSignal.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

function checkUrl(raw) {
  let url;
  try { url = new URL(String(raw)); }
  catch { throw new GatewayError('invalid_url', 'url must be an absolute http(s) URL'); }
  if (url.protocol !== 'https:') throw new GatewayError('invalid_url', 'only https URLs are fetched');
  if (!WEB_ALLOWLIST.includes(url.hostname)) throw new GatewayError('host_not_allowed', `only https://slaythespire2.net/ and https://slaythespire.wiki.gg/ pages are reachable`, { allowed: WEB_ALLOWLIST });
  if (url.href.length > 400) throw new GatewayError('invalid_url', 'url is too long');
  if (url.hostname.includes('slaythespire2.net')) {
    const version = url.searchParams.get('v');
    if (version && version !== REFERENCE_VERSION) throw new GatewayError('wrong_version', `only the ${REFERENCE_VERSION} profile is allowed; it is the one matching the installed ${INSTALLED_BUILD} build`);
    url.searchParams.set('v', REFERENCE_VERSION);
  }
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
  const signal = combinedSignal(request?.signal, AbortSignal.timeout(TIMEOUT_MS));
  try {
    response = await fetch(url.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'steambench-player/1.0 (game reference lookup)', Accept: 'text/html,text/plain' },
      signal,
    });
  } catch (e) {
    throw new GatewayError('web_unavailable', `could not reach ${url.hostname} (${e.cause?.code || e.name})`);
  }
  if (!response.ok) throw new GatewayError('web_status', `${url.hostname} returned HTTP ${response.status}`, { status: response.status });
  const type = response.headers.get('content-type') || '';
  if (!/text\/html|text\/plain|application\/json/i.test(type)) throw new GatewayError('web_type', `unsupported content type: ${type.split(';')[0] || 'unknown'}`);
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    try { await response.body?.cancel?.(); } catch { /* the body is already being rejected */ }
    throw tooLarge();
  }
  let raw;
  try { raw = await readBoundedResponse(response, MAX_BYTES, signal); }
  catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError('web_unavailable', `could not read ${url.hostname} (${error.cause?.code || error.name || 'stream error'})`);
  }

  const text = /json/i.test(type) ? raw : htmlToText(raw);
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
