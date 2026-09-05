// Steam login helpers for a room.
//
// Steam Big Picture shows a QR code that expires after about a minute and then
// blurs behind a reload button. Instead of asking a human to squint at the
// video and click it, we decode the QR out of the room's video frame, publish
// the URL to the dashboard (which renders a crisp QR and a tappable link), and
// click the reload button ourselves when the code goes stale.
//
// Note on tokens: the Steam desktop client stores its own refresh token
// encrypted per machine (ConnectCache in local.vdf), and there is no supported
// way to write one in from outside. So a login obtained in a browser cannot be
// handed to the client. What does carry over is the client's own state, as long
// as the "machine" looks the same: see pinned hostname/machine-id in rooms.js
// and the login template in seed.js.
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';

/** Where the reload button sits when no QR has been decoded yet (room pixels, 1280x720 Big Picture). */
export const RELOAD_FALLBACK = { x: 320, y: 385 };

/**
 * Decode the Steam login QR from a JPEG frame.
 * @returns {{url: string, center: {x: number, y: number}, width: number, height: number} | null}
 */
export function decodeLoginQr(jpegBuffer) {
  let raw;
  try {
    raw = jpeg.decode(jpegBuffer, { useTArray: true });
  } catch {
    return null;
  }
  const code = jsQR(raw.data, raw.width, raw.height);
  if (!code || !/^https:\/\/s\.team\//i.test(code.data || '')) return null;
  const c = code.location;
  const xs = [c.topLeftCorner.x, c.topRightCorner.x, c.bottomLeftCorner.x, c.bottomRightCorner.x];
  const ys = [c.topLeftCorner.y, c.topRightCorner.y, c.bottomLeftCorner.y, c.bottomRightCorner.y];
  return {
    url: code.data,
    center: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
    width: raw.width,
    height: raw.height,
  };
}
