import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OPS: [number, number, number][] = [];
OPS[0x00] = [0, 0, 0];
OPS[0x01] = [1, 0, 1];
OPS[0x02] = [4, 0, 1];
OPS[0x03] = [0, 1, 0];
OPS[0x04] = [0, 1, 2];
OPS[0x05] = [0, 2, 2];
OPS[0x06] = [0, 2, 3];
OPS[0x07] = [0, 3, 3];
for (const o of [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x18, 0x19, 0x1a, 0x1c, 0x1d, 0x1e, 0x20, 0x21, 0x22])
  OPS[o] = [0, 2, 1];
OPS[0x17] = [0, 1, 1];
OPS[0x1b] = [0, 1, 1];
OPS[0x30] = [2, 0, 0];
OPS[0x31] = [2, 1, 0];
OPS[0x32] = [2, 1, 0];
OPS[0x33] = [2, 0, 0];
OPS[0x34] = [0, 0, 0];
OPS[0x40] = [0, 1, 1];
OPS[0x41] = [0, 2, 0];
OPS[0x50] = [0, 1, 0];
OPS[0x51] = [0, 1, 0];
OPS[0x52] = [0, 0, 1];
OPS[0x53] = [0, 1, 0];

const BIN = new TextEncoder();

function run(p: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const O = new Uint8Array(65536);
  let sp = 0, cp = 0, pc = 0, ip = 0, st = 0, ol = 0;
  const n = p.length;
  const fin = (c: number): { out: Uint8Array; code: number } => ({ out: O.slice(0, ol), code: c });
  const pushO = (bs: Uint8Array): number => (ol + bs.length > 65536 ? -11 : (O.set(bs, ol), (ol += bs.length), 0));
  for (;;) {
    if (st === 1000000) return fin(10);
    if (pc < 0 || pc >= n) return fin(9);
    const o = OPS[p[pc]];
    if (o === undefined) return fin(5);
    const [im, pops, push] = o;
    if (pc + 1 + im > n) return fin(9);
    st++;
    const nx = pc + 1 + im;
    if (sp < pops) return fin(2);
    if (sp - pops + push > 256) return fin(3);
    const op = p[pc];
    pc = nx;
    if (op === 0x00) return fin(0);
    if (op === 0x01) { D[sp++] = (p[nx - 1] << 24) >> 24; continue; }
    if (op === 0x02) { D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); continue; }
    if (op === 0x03) { sp--; continue; }
    if (op === 0x04) { D[sp] = D[sp - 1]; sp++; continue; }
    if (op === 0x05) { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; continue; }
    if (op === 0x06) { D[sp] = D[sp - 2]; sp++; continue; }
    if (op === 0x07) { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; continue; }
    if (op === 0x17) { D[sp - 1] = -D[sp - 1] | 0; continue; }
    if (op === 0x1b) { D[sp - 1] = ~D[sp - 1]; continue; }
    if (op >= 0x10 && op <= 0x22) {
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
    if (op >= 0x30 && op <= 0x32) {
      const rel = (p[nx - 2] | (p[nx - 1] << 8)) << 16 >> 16;
      let take = true;
      if (op !== 0x30) { const v = D[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
      if (take) pc = nx + rel;
      continue;
    }
    if (op === 0x33) {
      if (cp === 64) return fin(7);
      C[cp++] = nx;
      pc = p[nx - 2] | (p[nx - 1] << 8);
      continue;
    }
    if (op === 0x34) {
      if (cp === 0) return fin(8);
      pc = C[--cp];
      continue;
    }
    if (op === 0x40) {
      const ad = D[sp - 1];
      if (ad < 0 || ad > 255) return fin(6);
      D[sp - 1] = M[ad];
      continue;
    }
    if (op === 0x41) {
      const ad = D[sp - 1];
      if (ad < 0 || ad > 255) return fin(6);
      M[ad] = D[sp - 2]; sp -= 2;
      continue;
    }
    if (op === 0x50) {
      const bs = BIN.encode(String(D[sp - 1]));
      if (pushO(bs) === -11) return fin(11);
      sp--;
      continue;
    }
    if (op === 0x51) {
      if (pushO(Uint8Array.of(D[--sp] & 255)) === -11) return fin(11);
      continue;
    }
    if (op === 0x52) { D[sp++] = ip < inp.length ? inp[ip++] : -1; continue; }
    if (op === 0x53) return fin(D[--sp] & 255);
    return fin(5);
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}