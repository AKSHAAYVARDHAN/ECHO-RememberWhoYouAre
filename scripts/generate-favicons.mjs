import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve('public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. Generate Master SVG for EXIF (The Soul Within)
// Clean, bold, iconic monospace "E" with cosmic soul star mark on deep black
function createIconSvg(size, isAppleTouch = false) {
  const rx = isAppleTouch ? 0 : Math.round(size * 0.2);
  const strokeW = Math.max(1, Math.round(size * 0.015));

  // Scale coordinates to target size
  const s = size / 512;
  
  // Glyph dimensions (based on 512 grid)
  // Vertical stem: x: 136..196 (width 60), y: 116..396 (height 280)
  // Top bar: y: 116..170 (height 54), x: 136..376 (width 240)
  // Mid bar: y: 229..283 (height 54), x: 136..336 (width 200)
  // Bottom bar: y: 342..396 (height 54), x: 136..376 (width 240)
  // Cosmic soul spark: diamond at x: 388, y: 256, r: 24
  
  const pathD = `
    M ${136 * s} ${116 * s}
    H ${376 * s}
    V ${170 * s}
    H ${196 * s}
    V ${229 * s}
    H ${336 * s}
    V ${283 * s}
    H ${196 * s}
    V ${342 * s}
    H ${376 * s}
    V ${396 * s}
    H ${136 * s}
    Z
  `;

  // Cosmic soul diamond at (380, 256)
  const sparkD = size >= 64 ? `
    <path d="M ${380 * s} ${226 * s} Q ${380 * s} ${256 * s} ${410 * s} ${256 * s} Q ${380 * s} ${256 * s} ${380 * s} ${286 * s} Q ${380 * s} ${256 * s} ${350 * s} ${256 * s} Q ${380 * s} ${256 * s} ${380 * s} ${226 * s} Z" fill="#E8EDF5" />
  ` : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${rx}" fill="#000000" />
      <rect x="${strokeW / 2}" y="${strokeW / 2}" width="${size - strokeW}" height="${size - strokeW}" rx="${rx}" fill="none" stroke="rgba(255, 255, 255, 0.12)" stroke-width="${strokeW}" />
      <path d="${pathD.trim()}" fill="#FFFFFF" />
      ${sparkD}
    </svg>
  `;
}

// Helper to create ICO binary from PNG buffers
function createIco(pngBuffers) {
  // pngBuffers: array of { width, height, buffer }
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const entries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // Palette colors
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Offset of image data
    entries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map(p => p.buffer)]);
}

async function buildFavicons() {
  console.log('Generating EXIF favicon package...');

  // 1. Generate PNGs at required resolutions
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'apple-touch-icon.png', size: 180, isApple: true },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  const pngMap = {};

  for (const item of sizes) {
    const svg = createIconSvg(item.size, item.isApple);
    const buf = await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9 })
      .toBuffer();
    
    fs.writeFileSync(path.join(PUBLIC_DIR, item.name), buf);
    pngMap[item.size] = buf;
    console.log(`Generated: ${item.name} (${item.size}x${item.size})`);
  }

  // 2. Generate multi-resolution favicon.ico (16, 32, 48)
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: pngMap[16] },
    { width: 32, height: 32, buffer: pngMap[32] },
    { width: 48, height: 48, buffer: pngMap[48] },
  ]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log('Generated: favicon.ico (16x16, 32x32, 48x48)');

  // 3. Generate site.webmanifest
  const webmanifest = {
    name: "EXIF - The Soul Within",
    short_name: "EXIF",
    description: "An endless cosmic environment where personal affirmations emerge spontaneously from an infinite black space.",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
    theme_color: "#000000",
    background_color: "#000000",
    display: "standalone",
    start_url: "/"
  };
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'site.webmanifest'),
    JSON.stringify(webmanifest, null, 2)
  );
  console.log('Generated: site.webmanifest');

  // Also write SVG version for modern browser vector favicon support
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'favicon.svg'),
    createIconSvg(512, false)
  );
  console.log('Generated: favicon.svg');
}

buildFavicons().catch(err => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
