// Lossless asset packaging after imagegen: resize only, preserve the generated alpha.
// node audits/map-category-markers/prepare-asset.cjs <category-slug> <generated.png>
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PNG } = require('pngjs');
const [slug, source] = process.argv.slice(2);
if (!/^[a-z]+(?:-[a-z]+)+$/.test(slug ?? '') || !source || !fs.existsSync(source)) {
  throw new Error('Expected category slug and existing generated PNG path');
}
const original = PNG.sync.read(fs.readFileSync(source));
if (!original.alpha) throw new Error('The generated image must have a real alpha channel');
const target = path.join(process.cwd(), 'assets/map-markers');
fs.mkdirSync(target, { recursive: true });
for (const density of [1, 2, 3]) {
  const file = path.join(target, `${slug}${density === 1 ? '' : `@${density}x`}.png`);
  const size = String(64 * density);
  execFileSync('sips', ['-z', size, size, source, '--out', file], { stdio: 'ignore' });
  // Drop generator metadata after resizing without changing the RGBA pixels.
  fs.writeFileSync(file, PNG.sync.write(PNG.sync.read(fs.readFileSync(file))));
  console.log(`${path.basename(file)}: ${fs.statSync(file).size} bytes`);
}
