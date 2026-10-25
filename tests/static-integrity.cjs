'use strict';
// Static project integrity checks with Node.js built-ins only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const exists = p => fs.existsSync(path.join(root, p));

const html = read('index.html');
const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
assert.deepEqual([...new Set(duplicates)], [], 'index.html must not contain duplicate static IDs');
const htmlRefs = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)]
  .map(m => m[1]).filter(v => v.startsWith('./'));
for (const ref of htmlRefs) assert.ok(exists(ref.slice(2)), `missing HTML asset: ${ref}`);

const sw = read('service-worker.js');
const shellBlock = (sw.match(/const APP_SHELL = \[([\s\S]*?)\];/) || [])[1];
assert.ok(shellBlock, 'service worker must declare APP_SHELL');
const assets = [...shellBlock.matchAll(/["'](\.[^"']+)["']/g)].map(m => m[1]);
for (const asset of assets) assert.ok(exists(asset.slice(2)), `missing service-worker asset: ${asset}`);
assert.match(sw, /hansu-board-arena-v0\.6\.3/, 'service-worker cache version should match release');

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.ok(manifest.name && manifest.start_url && manifest.scope, 'web manifest must have required fields');
for (const worker of ['workers/chess-worker.js', 'workers/janggi-worker.js', 'workers/go-worker.js']) {
  const source = read(worker);
  for (const match of source.matchAll(/importScripts\(['"]([^'"]+)['"]\)/g)) {
    const target = path.normalize(path.join(path.dirname(worker), match[1]));
    assert.ok(exists(target), `missing Worker import: ${worker} -> ${target}`);
  }
}

const jsFiles = [];
for (const dir of ['js', 'workers']) {
  const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(entry => {
    const rel = path.join(d, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (entry.isFile() && rel.endsWith('.js')) jsFiles.push(rel);
  });
  walk(dir);
}
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `JavaScript syntax error in ${file}: ${result.stderr}`);
}
console.log(`PASS: ${htmlRefs.length} HTML asset references exist; no duplicate IDs`);
console.log(`PASS: ${assets.length} service-worker assets and Worker imports exist`);
console.log(`PASS: web manifest is valid; ${jsFiles.length} JavaScript files pass syntax checks`);
