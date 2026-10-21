/**
 * Lightweight, zero-dependency QR Code matrix generator in pure TypeScript.
 * Generates standard QR Code (Version 1-4, ECC Level M) matrices for URLs.
 */

// Format information strings for Level M (mask patterns 0..7)
const FORMAT_INFO_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0
];

// GF(256) Log & Antilog tables for Reed-Solomon Error Correction
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    EXP[i + 255] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x & 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP[LOG[x] + LOG[y]];
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, EXP[i]]);
  }
  return poly;
}

function calculateEcc(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = rsGeneratorPoly(eccLen);
  const ecc = new Array(eccLen).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ ecc[0];
    ecc.shift();
    ecc.push(0);
    if (factor !== 0) {
      for (let j = 0; j < eccLen; j++) {
        ecc[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return new Uint8Array(ecc);
}

// Version definitions for Level M: [version, size, dataCapacityBytes, eccBytes]
const QR_SPECS = [
  { version: 1, size: 21, dataCap: 14, eccLen: 10 },
  { version: 2, size: 25, dataCap: 26, eccLen: 16 },
  { version: 3, size: 29, dataCap: 42, eccLen: 26 },
  { version: 4, size: 33, dataCap: 62, eccLen: 36 },
  { version: 5, size: 37, dataCap: 84, eccLen: 48 },
];

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  
  // Pick smallest fitting version
  const spec = QR_SPECS.find((s) => s.dataCap >= bytes.length + 3) || QR_SPECS[QR_SPECS.length - 1];
  const { size, dataCap, eccLen } = spec;

  // 1. Bitstream assembly: Mode (Byte = 0100) + Character Count + Data + Terminator
  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(bytes.length, 8); // Length indicator
  for (const b of bytes) {
    pushBits(b, 8);
  }
  pushBits(0b0000, 4); // Terminator
  while (bits.length % 8 !== 0) bits.push(0); // Pad to byte boundary

  const rawBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | (bits[i + j] || 0);
    }
    rawBytes.push(byteVal);
  }

  // Pad to capacity with alternating 0xEC, 0x11
  let padToggle = true;
  while (rawBytes.length < dataCap) {
    rawBytes.push(padToggle ? 0xec : 0x11);
    padToggle = !padToggle;
  }

  const dataArray = new Uint8Array(rawBytes.slice(0, dataCap));
  const eccArray = calculateEcc(dataArray, eccLen);

  // Combine data + ECC
  const finalStream: number[] = [];
  for (const b of dataArray) {
    for (let i = 7; i >= 0; i--) finalStream.push((b >> i) & 1);
  }
  for (const b of eccArray) {
    for (let i = 7; i >= 0; i--) finalStream.push((b >> i) & 1);
  }

  // 2. Build Grid
  const grid: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // Finder Patterns (7x7) + Separators
  function addFinder(startX: number, startY: number) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = startX + dx;
        const y = startY + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          if (
            (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
            (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
            (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
          ) {
            grid[y][x] = true;
          } else {
            grid[y][x] = false;
          }
        }
      }
    }
  }

  addFinder(0, 0);
  addFinder(size - 7, 0);
  addFinder(0, size - 7);

  // Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (grid[6][i] === null) grid[6][i] = val;
    if (grid[i][6] === null) grid[i][6] = val;
  }

  // Alignment Pattern for Version >= 2
  if (spec.version >= 2) {
    const alignPos = size - 7;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const isBorder = Math.abs(dx) === 2 || Math.abs(dy) === 2;
        const isCenter = dx === 0 && dy === 0;
        grid[alignPos + dy][alignPos + dx] = isBorder || isCenter;
      }
    }
  }

  // Dark module
  grid[size - 8][8] = true;

  // Format info area reservation (around finders)
  for (let i = 0; i < 9; i++) {
    if (grid[8][i] === null) grid[8][i] = false;
    if (grid[i][8] === null) grid[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (grid[8][i] === null) grid[8][i] = false;
    if (grid[i][8] === null) grid[i][8] = false;
  }

  // 3. Place Data Bits using Zig-Zag Scan
  let bitIdx = 0;
  let upwards = true;
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x--; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const y of rows) {
      for (const col of [x, x - 1]) {
        if (grid[y][col] === null) {
          const bit = bitIdx < finalStream.length ? finalStream[bitIdx++] : 0;
          // Apply mask 0: (x + y) % 2 === 0
          const mask = (col + y) % 2 === 0;
          grid[y][col] = (bit === 1) !== mask;
        }
      }
    }
    upwards = !upwards;
  }

  // 4. Write Format Information (Mask 0, Level M)
  const formatBits = FORMAT_INFO_M[0];
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    // Top-left
    if (i < 6) grid[8][i] = bit;
    else if (i < 8) grid[8][i + 1] = bit;
    else if (i === 8) grid[7][8] = bit;
    else grid[14 - i][8] = bit;

    // Split
    if (i < 8) grid[size - 1 - i][8] = bit;
    else grid[8][size - 15 + i] = bit;
  }

  return grid.map((row) => row.map((cell) => cell ?? false));
}
