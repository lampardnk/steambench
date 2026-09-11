#!/usr/bin/env node
// Manual probe: create a room lobby, attach a read-only observer session, and grab a frame.
// Usage: node server/bin/wolf-probe.mjs <lobby|observe|frame|list|stop|stop-session> ...
import { WolfClient, mjpegPipeline, NVIDIA_BUFFER_CAPS } from '../lib/wolf.js';
import net from 'node:net';
import fs from 'node:fs';

const wolf = new WolfClient(process.env.WOLF_SOCKET_PATH || '.runtime/wolf/wolf.sock');
const [cmd, ...args] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (cmd === 'lobby') {
  const name = args[0] || 'probe';
  const image = process.env.ROOM_IMAGE || 'ghcr.io/games-on-whales/steam:edge';
  const env = [
    'RUN_GAMESCOPE=1', 'GOW_REQUIRED_DEVICES=/dev/input/* /dev/dri/* /dev/nvidia*',
    ...(process.env.ROOM_ENV ? process.env.ROOM_ENV.split(';') : []),
  ];
  const id = await wolf.createLobby({
    name, width: 1280, height: 720, fps: 60, renderNode: '/dev/dri/renderD128', bufferCaps: NVIDIA_BUFFER_CAPS,
    runnerStateFolder: `rooms/${name}`,
    runner: {
      type: 'docker', name: `steambench-room-${name}`, image, mounts: [], env, devices: [], ports: [],
      base_create_json: JSON.stringify({ HostConfig: {
        IpcMode: 'host', CapAdd: ['SYS_ADMIN', 'SYS_NICE', 'SYS_PTRACE', 'NET_RAW', 'MKNOD', 'NET_ADMIN'],
        SecurityOpt: ['seccomp=unconfined', 'apparmor=unconfined'], Ulimits: [{ Name: 'nofile', Hard: 10240, Soft: 10240 }],
        Privileged: false, DeviceCgroupRules: ['c 13:* rmw', 'c 244:* rmw'] } }),
    },
  });
  console.log('lobby', id);
} else if (cmd === 'observe') {
  const [lobbyId, portStr] = args; const port = Number(portStr || 39001);
  const sid = await wolf.addSession({ width: 640, height: 360, fps: 30 });
  console.log('session', sid);
  await sleep(1500);
  await wolf.startSession(sid, { width: 1280, height: 720, fps: 60, gstPipeline: mjpegPipeline({ port, fps: 5 }), pingPort: port });
  await wolf.sendVideoPing(port);
  console.log('started consumer on', port);
  await sleep(2500);
  await wolf.joinLobby(lobbyId, sid);
  console.log('joined lobby');
} else if (cmd === 'frame') {
  const [portStr, out] = args; const port = Number(portStr || 39001);
  const sock = net.connect(port, '127.0.0.1');
  let buf = Buffer.alloc(0);
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    const s = buf.indexOf(Buffer.from([0xff, 0xd8])); const e = buf.indexOf(Buffer.from([0xff, 0xd9]), s + 2);
    if (s >= 0 && e > s) { fs.writeFileSync(out || 'frame.jpg', buf.subarray(s, e + 2)); console.log('frame bytes', e + 2 - s); sock.destroy(); process.exit(0); }
  });
  sock.on('error', (e) => { console.error('tcp error', e.message); process.exit(1); });
  setTimeout(() => { console.error('no frame in 15s'); process.exit(2); }, 15000);
} else if (cmd === 'list') {
  console.log(JSON.stringify({ lobbies: await wolf.listLobbies(), sessions: await wolf.listSessions() }, null, 1));
} else if (cmd === 'stop') {
  const [lobbyId] = args; await wolf.stopLobby(lobbyId); console.log('stopped');
} else if (cmd === 'stop-session') {
  await wolf.stopSession(args[0]); console.log('stopped session');
} else {
  console.log('commands: lobby NAME | observe LOBBY_ID [PORT] | frame [PORT] [OUT] | list | stop LOBBY_ID | stop-session SID');
}
