// Tutorial planet (owner, 16 November 2026): the real room runs in the page, so the tutorial plays
// with exactly the same rules as online play without a server. An in-memory socket pair stands in
// for the network: the client sees an ordinary WebSocket, the room an ordinary server socket.
import { Room } from '../../server/src/room';
import type { CfSocket } from '../../server/src/room';
import { TUTORIAL } from '../../sim/planets';

class LocalSocket extends EventTarget {
  readyState = 0;
  binaryType: BinaryType = 'arraybuffer';
  peer: LocalSocket | null = null;
  accept(): void {}
  open(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }
  send(data: string | ArrayBuffer | ArrayBufferView): void {
    const peer = this.peer;
    if (this.readyState !== 1 || !peer) return;
    // Copy binary frames, as a network would: neither side may share the other's buffers.
    const copy = typeof data === 'string' ? data : data instanceof ArrayBuffer ? data.slice(0) : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    queueMicrotask(() => {
      if (peer.readyState === 1) peer.dispatchEvent(new MessageEvent('message', { data: copy }));
    });
  }
  close(code = 1000, reason = ''): void {
    if (this.readyState >= 2) return;
    const peer = this.peer;
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent('close', { code, reason }));
    if (peer && peer.readyState < 2) {
      queueMicrotask(() => {
        peer.readyState = 3;
        peer.dispatchEvent(new CloseEvent('close', { code, reason }));
      });
    }
  }
}

let room: Room | null = null;

/** The tutorial's room, created on first use and kept for the page's lifetime. */
export function tutorialRoom(): Room {
  if (!room) {
    room = new Room();
    room.setPlanet(TUTORIAL);
    room.setManualBots(true);
    room.setLockstep(true);
  }
  return room;
}

/** A NetClient transport: connects to the local tutorial room instead of the server. */
export function localTransport(url: string): WebSocket {
  const r = tutorialRoom();
  const q = new URL(url, 'http://local').searchParams;
  const client = new LocalSocket();
  const server = new LocalSocket();
  client.peer = server;
  server.peer = client;
  setTimeout(() => {
    server.readyState = 1;
    client.open();
    r.join(server as unknown as CfSocket, q.get('name'), q.get('resume'), null);
  }, 0);
  return client as unknown as WebSocket;
}
