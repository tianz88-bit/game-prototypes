// Minimal QR code encoder (ISO/IEC 18004): byte mode, error correction level M, versions 1-6
// (up to 106 bytes, plenty for a URL). Written in-house to avoid a dependency (owner decision).
// Follows the structure of Project Nayuki's reference encoder. Returns a square grid of booleans
// (true = dark), without the quiet zone.

/** Per version (index 1-6), level M: [total codewords, ECC codewords per block, number of blocks]. */
const LAYOUT_M: readonly [number, number, number][] = [
  [0, 0, 0],
  [26, 10, 1],
  [44, 16, 1],
  [70, 26, 1],
  [100, 18, 2],
  [134, 24, 2],
  [172, 16, 4],
];

/** Alignment pattern centres per version (version 1 has none). */
const ALIGN: readonly number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

const FORMAT_M = 0; // Level M's two format bits are 00.

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

/** The data codewords for text in byte mode, padded to the version's capacity. */
function dataCodewords(bytes: Uint8Array, version: number): number[] {
  const [total, ecc, blocks] = LAYOUT_M[version];
  const capacity = total - ecc * blocks;
  const bits: number[] = [];
  const put = (value: number, len: number): void => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4); // byte mode
  put(bytes.length, 8); // character count (8 bits for versions 1-9)
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, capacity * 8 - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((v, b) => (v << 1) | b, 0));
  for (let pad = 0xec; out.length < capacity; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Split into blocks, add Reed-Solomon codewords, and interleave. */
function withEcc(data: number[], version: number): number[] {
  const [total, eccLen, numBlocks] = LAYOUT_M[version];
  const numShort = numBlocks - (total % numBlocks);
  const shortLen = Math.floor(total / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - eccLen + (i < numShort ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const block = [...dat];
    if (i < numShort) block.push(0);
    blocks.push([...block, ...rsRemainder(dat, divisor)]);
  }
  const out: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= numShort) out.push(b[i]);
    });
  }
  return out;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** Readability penalty (runs, 2x2 blocks, finder look-alikes, dark/light balance); lower is better. */
function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        const cur = pass ? m[b][a] : m[a][b];
        const prev = pass ? m[b - 1][a] : m[a][b - 1];
        if (cur === prev) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score++;
        } else run = 1;
      }
    }
  }
  for (let y = 0; y + 1 < n; y++) {
    for (let x = 0; x + 1 < n; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
  }
  // Patterns that look like a finder (1:1:3:1:1 with 4 light modules beside it) confuse scanners.
  const A = [true, false, true, true, true, false, true, false, false, false, false];
  const B = [...A].reverse();
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < n; a++) {
      for (let b = 0; b + 11 <= n; b++) {
        let ma = true;
        let mb = true;
        for (let k = 0; k < 11; k++) {
          const v = pass ? m[b + k][a] : m[a][b + k];
          if (v !== A[k]) ma = false;
          if (v !== B[k]) mb = false;
        }
        if (ma) score += 40;
        if (mb) score += 40;
      }
    }
  }
  const dark = m.reduce((s, row) => s + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return score;
}

/** forceMask (0-7) skips the mask search; for tests. */
export function encodeQr(text: string, forceMask?: number): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= 6 && LAYOUT_M[version][0] - LAYOUT_M[version][1] * LAYOUT_M[version][2] < bytes.length + 2) version++;
  if (version > 6) throw new Error('Text too long for this QR encoder');
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setFixed = (x: number, y: number, dark: boolean): void => {
    modules[y][x] = dark;
    fixed[y][x] = true;
  };

  // Timing patterns, finders (with separators), alignment patterns.
  for (let i = 0; i < size; i++) {
    setFixed(6, i, i % 2 === 0);
    setFixed(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setFixed(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const align = ALIGN[version];
  const last = align.length - 1;
  align.forEach((ay, i) =>
    align.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFixed(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const drawFormat = (mask: number): void => {
    const data = (FORMAT_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number): boolean => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFixed(8, i, bit(i));
    setFixed(8, 7, bit(6));
    setFixed(8, 8, bit(7));
    setFixed(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFixed(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFixed(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFixed(8, size - 15 + i, bit(i));
    setFixed(8, size - 8, true); // dark module
  };
  drawFormat(0); // reserve the format areas

  // Data in the zigzag order, right to left in column pairs.
  const codewords = withEcc(dataCodewords(bytes, version), version);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fixed[y][x] || i >= codewords.length * 8) continue;
        modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
        i++;
      }
    }
  }

  // Try every mask; keep the most readable.
  const apply = (mask: number): void => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
  };
  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== undefined && mask !== forceMask) continue;
    apply(mask);
    drawFormat(mask);
    const score = penalty(modules);
    if (score < bestScore) {
      bestScore = score;
      best = mask;
    }
    apply(mask); // undo
  }
  apply(best);
  drawFormat(best);
  return modules;
}
