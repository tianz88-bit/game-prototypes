// Steroids-Alpha QR encoder (prototypes/steroids-alpha/src/ui/qr.ts): its output must match a reference
// encoder bit for bit. The fixture holds matrices from python-qrcode (level M, byte mode) for three texts
// at every mask, so the test needs no QR library. Also checks the mask search returns a valid code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['prototypes/steroids-alpha/src/ui/qr.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { encodeQr } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/steroids-qr.fixture.json', import.meta.url), 'utf8'));
const asRows = (g) => g.map((r) => r.map((b) => (b ? '1' : '0')).join(''));
for (const c of fixture.cases) assert.deepEqual(asRows(encodeQr(c.text, c.mask)), c.rows, `${c.text.slice(0, 20)} mask ${c.mask}`);
// The automatic mask choice is one of those references.
const url = 'https://daily-daily-games.itch.io/steroids-alpha';
const auto = asRows(encodeQr(url));
assert(fixture.cases.some((c) => c.text === url && JSON.stringify(c.rows) === JSON.stringify(auto)), 'auto mask matches a reference');
assert.throws(() => encodeQr('x'.repeat(200)), /too long/);
console.log(`Steroids-Alpha QR encoder matches the reference on ${fixture.cases.length} codes.`);
