import { mkdirSync as MC, readdirSync as RC, readFileSync as FC, writeFileSync as WC } from 'node:fs';
import { join as JC } from 'node:path';

const IM: number[] = [], PP: number[] = [], PS: number[] = [];
for (const [o, i, p, u] of [
  [0x00, 0, 0, 0], [0x01, 1, 0, 1], [0x02, 4, 0, 1], [0x03, 0, 1, 0], [0x04, 0, 1, 2],
  [0x05, 0, 2, 2], [0x06, 0, 2, 3], [0x07, 0, 3, 3], [0x17, 0, 1, 1], [0x1b, 0, 1, 1],
  [0x30, 2, 0, 0], [0x31, 2, 1, 0], [0x32, 2, 1, 0], [0x33, 2, 0, 0], [0x34, 0, 0, 0],
  [0x40, 0, 1, 1], [0x41, 0, 2, 0], [0x50, 0, 1, 0], [0x51, 0, 1, 0], [0x52, 0, 0, 1],
  [0x53, 0, 1, 0],
]) { IM[o] = i; PP[o] = p; PS[o] = u; }
for (let o = 0x10; o <= 0x22; o++) if (o !== 0x17 && o !== 0x1b && o !== 0x1f) { IM[o] = 0; PP[o] = 2; PS[o] = 1; }

const TE = new TextEncoder();

function run(p: Uint8Array, inp: Uint8Array) {
  const D = new Int32Array(256), C = new Int32Array(64), MM = new Int32Array(256);
  const O = new Uint8Array(65536);
  let sp = 0, cp = 0, pc = 0, ip = 0, st = 0, ol = 0;
  const n = p.length;
  const fin = (c: number) => ({ out: O.slice(0, ol), code: c });
  for (;;) {
    if (st === 1000000) return fin(10);
    if (pc < 0 || pc >= n) return fin(9);
    const op = p[pc], im = IM[op];
    if (PP[op] === undefined) return fin(5);
    if (pc + 1 + im > n) return fin(9);
    st++;
    const nx = pc + 1 + im;
    if (sp < PP[op]) return fin(2);
    if (sp - PP[op] + PS[op] > 256) return fin(3);
    pc = nx;
    if (op < 0x08) {
      if (op === 0x00) return fin(0);
      if (op === 0x01) D[sp++] = (p[nx - 1] << 24) >> 24;
      else if (op === 0x02) D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24);
      else if (op === 0x03) sp--;
      else if (op === 0x04) { D[sp] = D[sp - 1]; sp++; }
      else if (op === 0x05) { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; }
      else if (op === 0x06) { D[sp] = D[sp - 2]; sp++; }
      else { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; }
      continue;
    }
    if (op < 0x23) {
      if (op === 0x17) { D[sp - 1] = -D[sp - 1] | 0; continue; }
      if (op === 0x1b) { D[sp - 1] = ~D[sp - 1]; continue; }
      const b = D[sp - 1], a = D[sp - 2];
      let r = 0;
      if (op === 0x13 || op === 0x15) {
        if (b === 0) return fin(4);
        r = op === 0x13 ? (a === -2147483648 && b === -1 ? a : a / b | 0) : Math.floor((a >>> 0) / (b >>> 0)) | 0;
      } else if (op === 0x14 || op === 0x16) {
        if (b === 0) return fin(4);
        r = op === 0x14 ? (b === -1 ? 0 : a % b | 0) : (a >>> 0) % (b >>> 0) | 0;
      } else if (op === 0x10) r = a + b | 0;
      else if (op === 0x11) r = a - b | 0;
      else if (op === 0x12) r = Math.imul(a, b);
      else if (op === 0x18) r = a & b;
      else if (op === 0x19) r = a | b;
      else if (op === 0x1a) r = a ^ b;
      else if (op === 0x1c) r = a << (b & 31);
      else if (op === 0x1d) r = a >> (b & 31);
      else if (op === 0x1e) r = a >>> (b & 31) | 0;
      else if (op === 0x20) r = a === b ? 1 : 0;
      else if (op === 0x21) r = a < b ? 1 : 0;
      else r = a >>> 0 < b >>> 0 ? 1 : 0;
      sp -= 2; D[sp++] = r;
      continue;
    }
    if (op < 0x35) {
      if (op === 0x34) {
        if (cp === 0) return fin(8);
        pc = C[--cp];
        continue;
      }
      if (op === 0x33) {
        if (cp === 64) return fin(7);
        C[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        continue;
      }
      const rel = (p[nx - 2] | (p[nx - 1] << 8)) << 16 >> 16;
      let take = true;
      if (op !== 0x30) { const v = D[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
      if (take) pc = nx + rel;
      continue;
    }
    if (op === 0x40) {
      const ad = D[sp - 1];
      if (ad < 0 || ad > 255) return fin(6);
      D[sp - 1] = MM[ad];
      continue;
    }
    if (op === 0x41) {
      const ad = D[sp - 1];
      if (ad < 0 || ad > 255) return fin(6);
      MM[ad] = D[sp - 2]; sp -= 2;
      continue;
    }
    if (op === 0x53) return fin(D[--sp] & 255);
    if (op === 0x52) { D[sp++] = ip < inp.length ? inp[ip++] : -1; continue; }
    if (op === 0x50) {
      const bs = TE.encode(String(D[sp - 1]));
      if (ol + bs.length > 65536) return fin(11);
      O.set(bs, ol); ol += bs.length; sp--;
      continue;
    }
    if (ol === 65536) return fin(11);
    O[ol++] = D[--sp] & 255;
  }
}

export { run };
