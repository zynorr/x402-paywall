import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import { GifWriter } from "omggif";

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(__dirname, "..", "assets");
const outputPath = join(__dirname, "..", "assets", "demo-paywall-flow.gif");

// Get all PNG screenshots sorted by name
const files = readdirSync(screenshotsDir)
  .filter((f) => f.endsWith(".png"))
  .sort();

if (files.length === 0) {
  console.error("No screenshots found in", screenshotsDir);
  process.exit(1);
}

console.log(`Found ${files.length} screenshots:`, files);

// Read and decode all PNGs
const frames = files.map((file) => {
  const buf = readFileSync(join(screenshotsDir, file));
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
});

// Use the first frame's dimensions
const width = frames[0].width;
const height = frames[0].height;

// Simple color quantizer: maps RGB to a 6x6x6 evenly-spaced cube (216 colors)
// plus 40 extra for common UI colors
function quantizeColor(r, g, b) {
  // Map to 6 levels per channel = 216 colors
  const qr = Math.round(r / 51) * 51;
  const qg = Math.round(g / 51) * 51;
  const qb = Math.round(b / 51) * 51;
  return { r: qr, g: qg, b: qb };
}

function buildPalette(frame) {
  const palette = [];
  const colorMap = new Map();
  let nextIndex = 0;

  // First pass: collect all quantized colors
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const idx = (y * frame.width + x) * 4;
      const r = frame.data[idx];
      const g = frame.data[idx + 1];
      const b = frame.data[idx + 2];
      const a = frame.data[idx + 3];

      // Use full color if transparent
      const q = a < 128 ? { r: 0, g: 0, b: 0 } : quantizeColor(r, g, b);
      const key = `${q.r},${q.g},${q.b}`;

      if (!colorMap.has(key) && nextIndex < 256) {
        colorMap.set(key, nextIndex++);
        palette.push(q);
      }
    }
  }

  // Ensure we have at least 256 entries (pad with black)
  while (palette.length < 256) {
    palette.push({ r: 0, g: 0, b: 0 });
  }

  return { palette, colorMap };
}

// Create GIF buffer (20MB max)
const gifBuffer = Buffer.alloc(20 * 1024 * 1024);
const writer = new GifWriter(gifBuffer, width, height, {
  loopCount: 0,
  background: 0x1a1a2e,
});

// Frame delays in 10ms units
const delays = [200, 250, 250, 300]; // 2s, 2.5s, 2.5s, 3s

for (let i = 0; i < frames.length; i++) {
  const frame = frames[i];
  const { palette, colorMap } = buildPalette(frame);

  // Build indexed pixel array
  const indexedPixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = frame.data[idx];
      const g = frame.data[idx + 1];
      const b = frame.data[idx + 2];
      const a = frame.data[idx + 3];

      if (a < 128) {
        indexedPixels[y * width + x] = 0;
        continue;
      }

      const q = quantizeColor(r, g, b);
      const key = `${q.r},${q.g},${q.b}`;
      indexedPixels[y * width + x] = colorMap.get(key) ?? 0;
    }
  }

  // Build GIF palette as array of RGB integers (e.g. 0xFF0000)
  // omggif expects palette as array of integer color values
  const gifPalette = [];
  for (let j = 0; j < palette.length; j++) {
    gifPalette.push((palette[j].r << 16) | (palette[j].g << 8) | palette[j].b);
  }

  const delay = delays[i] ?? 200;
  const offset = writer.addFrame(0, 0, width, height, indexedPixels, {
    palette: gifPalette,
    delay,
    disposal: 2,
  });

  console.log(`Frame ${i + 1}/${files.length} added (${colorMap.size} colors, delay ${delay * 10}ms)`);
}

// Write the GIF file
const finalBuffer = gifBuffer.slice(0, writer.end());
writeFileSync(outputPath, finalBuffer);

console.log(`\nGIF created: ${outputPath}`);
console.log(`Size: ${(finalBuffer.length / 1024).toFixed(1)} KB`);
