import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input'
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output'

const IMM = new Uint8Array(256)
const POPS = new Uint8Array(256)
const PUSHES = new Uint8Array(256)
const KNOWN = new Set<number>()

function op(code: number, imm: number, pops: number, pushes: number): void {
  IMM[code] = imm
  POPS[code] = pops
  PUSHES[code] = pushes
  KNOWN.add(code)
}

op(0x00, 0, 0, 0)
op(0x01, 1, 0, 1)
op(0x02, 4, 0, 1)
op(0x03, 0, 1, 0)
op(0x04, 0, 1, 2)
op(0x05, 0, 2, 2)
op(0x06, 0, 2, 3)
op(0x07, 0, 3, 3)
op(0x17, 0, 1, 1)
op(0x1b, 0, 1, 1)
for (const c of [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
                 0x18, 0x19, 0x1a, 0x1c, 0x1d, 0x1e,
                 0x20, 0x21, 0x22]) op(c, 0, 2, 1)
op(0x30, 2, 0, 0)
op(0x31, 2, 1, 0)
op(0x32, 2, 1, 0)
op(0x33, 2, 0, 0)
op(0x34, 0, 0, 0)
op(0x40, 0, 1, 1)
op(0x41, 0, 2, 0)
op(0x50, 0, 1, 0)
op(0x51, 0, 1, 0)
op(0x52, 0, 0, 1)
op(0x53, 0, 1, 0)

const STEP_LIMIT = 1000000
const OUT_LIMIT = 65536
const STACK_LIMIT = 256
const CALL_LIMIT = 64

const DECIMAL = new TextEncoder()

type Result = { out: Uint8Array; code: number }

function execute(prog: Uint8Array, input: Uint8Array): Result {
  const n = prog.length
  const stack = new Int32Array(STACK_LIMIT)
  const calls = new Int32Array(CALL_LIMIT)
  const mem = new Int32Array(256)
  const outBuf = new Uint8Array(OUT_LIMIT)

  let sp = 0
  let cp = 0
  let outLen = 0
  let ip = 0
  let pc = 0
  let steps = 0

  const done = (code: number): Result => ({ out: outBuf.slice(0, outLen), code })

  for (;;) {
    if (steps === STEP_LIMIT) return done(10)
    if (pc < 0 || pc >= n) return done(9)

    const ins = prog[pc]
    if (!KNOWN.has(ins)) return done(5)

    const extra = IMM[ins]
    if (pc + extra >= n) return done(9)

    steps += 1
    const next = pc + 1 + extra
    const pops = POPS[ins]
    const pushes = PUSHES[ins]
    if (sp < pops) return done(2)
    if (sp - pops + pushes > STACK_LIMIT) return done(3)
    pc = next

    switch (ins) {
      case 0x00:
        return done(0)

      case 0x01:
        stack[sp] = (prog[next - 1] << 24) >> 24
        sp += 1
        break

      case 0x02:
        stack[sp] = prog[next - 4] | (prog[next - 3] << 8) | (prog[next - 2] << 16) | (prog[next - 1] << 24)
        sp += 1
        break

      case 0x03:
        sp -= 1
        break

      case 0x04:
        stack[sp] = stack[sp - 1]
        sp += 1
        break

      case 0x05: {
        const t = stack[sp - 1]
        stack[sp - 1] = stack[sp - 2]
        stack[sp - 2] = t
        break
      }

      case 0x06:
        stack[sp] = stack[sp - 2]
        sp += 1
        break

      case 0x07: {
        const a = stack[sp - 3]
        stack[sp - 3] = stack[sp - 2]
        stack[sp - 2] = stack[sp - 1]
        stack[sp - 1] = a
        break
      }

      case 0x17:
        stack[sp - 1] = -stack[sp - 1] | 0
        break

      case 0x1b:
        stack[sp - 1] = ~stack[sp - 1]
        break

      case 0x30:
      case 0x31:
      case 0x32: {
        const rel = ((prog[next - 2] | (prog[next - 1] << 8)) << 16) >> 16
        if (ins === 0x30) {
          pc = next + rel
        } else {
          const v = stack[--sp]
          if (ins === 0x31 ? v === 0 : v !== 0) pc = next + rel
        }
        break
      }

      case 0x33:
        if (cp === CALL_LIMIT) return done(7)
        calls[cp] = next
        cp += 1
        pc = prog[next - 2] | (prog[next - 1] << 8)
        break

      case 0x34:
        if (cp === 0) return done(8)
        cp -= 1
        pc = calls[cp]
        break

      case 0x40: {
        const addr = stack[sp - 1]
        if (addr < 0 || addr > 255) return done(6)
        stack[sp - 1] = mem[addr]
        break
      }

      case 0x41: {
        const addr = stack[sp - 1]
        const v = stack[sp - 2]
        if (addr < 0 || addr > 255) return done(6)
        mem[addr] = v
        sp -= 2
        break
      }

      case 0x50: {
        // decimal ASCII, sign only when negative, no padding, no newline
        const text = String(stack[sp - 1])
        const bytes = DECIMAL.encode(text)
        if (outLen + bytes.length > OUT_LIMIT) return done(11)
        sp -= 1
        outBuf.set(bytes, outLen)
        outLen += bytes.length
        break
      }

      case 0x51:
        if (outLen + 1 > OUT_LIMIT) return done(11)
        outBuf[outLen++] = stack[sp - 1] & 255
        sp -= 1
        break

      case 0x52:
        stack[sp] = ip < input.length ? input[ip++] : -1
        sp += 1
        break

      case 0x53:
        return done(stack[sp - 1] & 255)

      default: {
        const b = stack[sp - 1]
        const a = stack[sp - 2]
        let r = 0
        if (ins === 0x10) r = (a + b) | 0
        else if (ins === 0x11) r = (a - b) | 0
        else if (ins === 0x12) r = Math.imul(a, b)
        else if (ins === 0x13) {
          if (b === 0) return done(4)
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0
        } else if (ins === 0x14) {
          if (b === 0) return done(4)
          r = b === -1 ? 0 : (a % b) | 0
        } else if (ins === 0x15) {
          if (b === 0) return done(4)
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0
        } else if (ins === 0x16) {
          if (b === 0) return done(4)
          r = ((a >>> 0) % (b >>> 0)) | 0
        } else if (ins === 0x18) r = a & b
        else if (ins === 0x19) r = a | b
        else if (ins === 0x1a) r = a ^ b
        else if (ins === 0x1c) r = a << (b & 31)
        else if (ins === 0x1d) r = a >> (b & 31)
        else if (ins === 0x1e) r = (a >>> (b & 31)) | 0
        else if (ins === 0x20) r = a === b ? 1 : 0
        else if (ins === 0x21) r = a < b ? 1 : 0
        else if (ins === 0x22) r = (a >>> 0) < (b >>> 0) ? 1 : 0
        sp -= 2
        stack[sp] = r
        sp += 1
        break
      }
    }
  }
}

for (const id of readdirSync(INPUT_DIR).sort()) {
  const dir = join(INPUT_DIR, id)
  let prog: Uint8Array
  let input: Uint8Array
  try {
    prog = readFileSync(join(dir, 'program.bin'))
    input = readFileSync(join(dir, 'input.bin'))
  } catch {
    continue
  }
  const result = execute(prog, input)
  const outDir = join(OUTPUT_DIR, id)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'stdout.bin'), result.out)
  writeFileSync(join(outDir, 'exit.txt'), result.code + '\n')
}
