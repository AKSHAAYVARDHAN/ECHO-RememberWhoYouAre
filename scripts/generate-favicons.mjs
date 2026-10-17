import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve('public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Minimal, monochrome, bold geometric 'E' monogram on pure black background
function createIconSvg(size, isAppleTouch = false) {
  const rx = isAppleTouch ? 0 : Math.round(size * 0.12);
  const s = size / 512;

  const pathD = `
    M ${126 * s} ${96 * s}
    H ${386 * s}
    V ${156 * s}
    H ${196 * s}
    V ${226 * s}
    H ${346 * s}
    V ${286 * s}
    H ${196 * s}
    V ${356 * s}
    H ${386 * s}
    V ${416 * s}
    H ${126 * s}
    Z
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#000000" />
  <path d="${pathD.trim()}" fill="#FFFFFF" />
</svg>`;
}

// Helper to create ICO binary from PNG buffers
function createIco(pngBuffers) {
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

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buffer)]);
}

async function buildFavicons() {
  console.log('Generating ECHO favicon package...');

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
    name: "ECHO",
    short_name: "ECHO",
    description: "ECHO — Remember Who You Are. An endless cosmic environment where personal affirmations emerge spontaneously from an infinite black space.",
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

  // 4. Generate master vector SVG for browser tab vector icon support
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'favicon.svg'),
    createIconSvg(512, false)
  );
  console.log('Generated: favicon.svg');
}

buildFavicons().catch((err) => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
