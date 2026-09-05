#!/usr/bin/env node
// Seed a room home from the host's Steam install. Usage: node server/bin/seed-room.mjs <HOME_DIR> [STS2_PORT]
import { seedRoomHome } from '../lib/seed.js';
import os from 'node:os';
import path from 'node:path';
const [home, port] = process.argv.slice(2);
if (!home) { console.error('usage: seed-room.mjs HOME_DIR [STS2_PORT]'); process.exit(2); }
const H = os.homedir();
await seedRoomHome({
  home: path.resolve(home),
  hostSteam: process.env.STEAMBENCH_HOST_STEAM || path.join(H, '.local/share/Steam'),
  hostSteamRoot: process.env.STEAMBENCH_HOST_STEAM_ROOT || path.join(H, '.steam'),
  hostSts2: process.env.STEAMBENCH_HOST_STS2 || path.join(H, '.local/share/SlayTheSpire2'),
  sts2Port: Number(port || 15526),
  log: console.log,
});
console.log('seeded', home);
