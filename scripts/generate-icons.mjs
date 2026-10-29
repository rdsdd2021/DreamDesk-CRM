import fs from "fs";
import path from "path";
import zlib from "zlib";

// Simple PNG generator using raw uncompressed RGBA pixel buffers and zlib
function createPng(width, height, drawFn) {
  // 1. Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // 2. IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression deflate
  ihdrData.writeUInt8(0, 11); // filter default
  ihdrData.writeUInt8(0, 12); // interlace none
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // 3. Raw Scanlines
  // Each scanline begins with a filter-type byte (0 = none)
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // Deflate compressed data
  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk("IDAT", compressedData);

  // 4. IEND Chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC-32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// App Icon Painter
// Blue-indigo gradient background with crisp white graduation cap geometry
function drawAppIcon(x, y, w, h, maskable = false) {
  const nx = x / w;
  const ny = y / h;

  // Background gradient: from #1e3a8a (30, 58, 138) to #2563eb (37, 99, 235) to #4f46e5 (79, 70, 229)
  const t = (nx + ny) / 2;
  let bgR = Math.round(30 + t * 45);
  let bgG = Math.round(58 + t * 35);
  let bgB = Math.round(138 + t * 90);

  // Corner rounding for standard (non-maskable) icons
  if (!maskable) {
    const r = w * 0.22;
    const dx = x < r ? r - x : x > w - r ? x - (w - r) : 0;
    const dy = y < r ? r - y : y > h - r ? y - (h - r) : 0;
    if (dx > 0 && dy > 0 && dx * dx + dy * dy > r * r) {
      return [0, 0, 0, 0]; // Transparent outside rounded corner
    }
  }

  // Center coordinate mapping
  const cx = w / 2;
  const cy = h / 2 - h * 0.04;
  const scale = w / 512;

  // Cap geometry
  const px = x - cx;
  const py = y - cy;

  // Mortarboard diamond: |px| / (160 * scale) + |py - 10 * scale| / (70 * scale) <= 1
  const dX = Math.abs(px) / (160 * scale);
  const dY = Math.abs(py - 10 * scale) / (70 * scale);
  if (dX + dY <= 1) {
    return [255, 255, 255, 255]; // Pure white cap top
  }

  // Cap skullcap body (underneath diamond)
  if (py >= 15 * scale && py <= 85 * scale && Math.abs(px) <= 100 * scale) {
    const curve = ((px * px) / (100 * scale * 100 * scale)) * 30 * scale;
    if (py <= 65 * scale + curve) {
      return [226, 232, 240, 255]; // Light slate cap base
    }
  }

  // Tassel
  const tasselX = 140 * scale;
  if (Math.abs(px - tasselX) <= 5 * scale && py >= 10 * scale && py <= 120 * scale) {
    return [251, 191, 36, 255]; // Amber gold tassel
  }
  // Tassel tip circle
  const tdx = px - tasselX;
  const tdy = py - 125 * scale;
  if (tdx * tdx + tdy * tdy <= 9 * scale * 9 * scale) {
    return [245, 158, 11, 255];
  }

  // "CRM" badge text area at bottom
  const badgeY = h * 0.78;
  const badgeH = h * 0.08;
  const badgeW = w * 0.32;
  if (Math.abs(y - badgeY) <= badgeH / 2 && Math.abs(x - cx) <= badgeW / 2) {
    // White translucent pill background
    return [Math.min(255, bgR + 60), Math.min(255, bgG + 60), Math.min(255, bgB + 50), 255];
  }

  return [bgR, bgG, bgB, 255];
}

const iconsDir = path.join(process.cwd(), "public", "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

console.log("Generating PWA Icons...");
const sizes = [
  { size: 192, name: "icon-192.png", maskable: false },
  { size: 192, name: "icon-192-maskable.png", maskable: true },
  { size: 512, name: "icon-512.png", maskable: false },
  { size: 512, name: "icon-512-maskable.png", maskable: true },
];

for (const { size, name, maskable } of sizes) {
  const png = createPng(size, size, (x, y, w, h) => drawAppIcon(x, y, w, h, maskable));
  const outPath = path.join(iconsDir, name);
  fs.writeFileSync(outPath, png);
  console.log(`✓ Created ${outPath} (${png.length} bytes)`);
}
console.log("All PWA Icons generated successfully.");
