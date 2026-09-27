const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(size, text = 'S') {
  const width = size;
  const height = size;
  
  // Create RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);
  const radius = Math.floor(size * 0.22);
  const cx = width / 2;
  const cy = height / 2;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Rounded rect distance
      const dx = Math.max(Math.abs(x - cx) - (cx - radius), 0);
      const dy = Math.max(Math.abs(y - cy) - (cy - radius), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radius) {
        // Gradient from Indigo (#4f46e5) to Teal (#0d9488)
        const t = (x + y) / (width + height);
        const r = Math.round(79 * (1 - t) + 13 * t);
        const g = Math.round(70 * (1 - t) + 148 * t);
        const b = Math.round(229 * (1 - t) + 136 * t);
        
        // Draw lightning/S glyph in center
        // Simple procedural representation of letter S
        const nx = (x - cx) / (size * 0.32);
        const ny = (y - cy) / (size * 0.36);
        let isGlyph = false;
        
        // Check if inside S shape
        // Top curve, middle diagonal, bottom curve
        const dTop = Math.hypot(nx, ny + 0.45);
        const dBot = Math.hypot(nx, ny - 0.45);
        if (dTop < 0.6 && dTop > 0.25 && (ny < -0.15 || nx > -0.2)) {
          isGlyph = true;
        } else if (dBot < 0.6 && dBot > 0.25 && (ny > 0.15 || nx < 0.2)) {
          isGlyph = true;
        } else if (Math.abs(ny + nx * 0.7) < 0.28 && Math.abs(nx) < 0.5 && Math.abs(ny) < 0.45) {
          isGlyph = true;
        }
        
        if (isGlyph) {
          rgba[idx] = 255;
          rgba[idx + 1] = 255;
          rgba[idx + 2] = 255;
          rgba[idx + 3] = 255;
        } else {
          rgba[idx] = r;
          rgba[idx + 1] = g;
          rgba[idx + 2] = b;
          rgba[idx + 3] = 255;
        }
      } else {
        // Transparent outside rounded rect
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }

  // Build PNG chunks
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // Color type 6 (RGBA)
  ihdrData.writeUInt8(0, 10); // Compression
  ihdrData.writeUInt8(0, 11); // Filter
  ihdrData.writeUInt8(0, 12); // Interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk (with scanline filter byte 0)
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  let scanlineIdx = 0;
  for (let y = 0; y < height; y++) {
    scanlines[scanlineIdx++] = 0; // Filter None
    rgba.copy(scanlines, scanlineIdx, y * width * 4, (y + 1) * width * 4);
    scanlineIdx += width * 4;
  }
  const compressed = zlib.deflateSync(scanlines);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcTarget = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  chunk.writeUInt32BE(crc32(crcTarget), 8 + len);
  return chunk;
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach((size) => {
  const pngBuf = createPng(size);
  const dest = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(dest, pngBuf);
  console.log(`Generated ${dest} (${pngBuf.length} bytes)`);
});
