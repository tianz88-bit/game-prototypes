// pack-assets hook (see scripts/pack-assets.js): runs after the R2 fetch, before loose/ is copied.
// The Human Nomad delivery zip nests its parts under loose/ships/human-nomad/scrappy-v1/; pack-assets
// copies only files directly in loose/. Copy each approved part byte-for-byte to loose/<ship>-<asset>.png,
// refusing any file whose SHA-256 differs from the approved kit manifest. Pixels are never changed here.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import buildTerrain from './terrain-v09/build-terrain.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIPS = [{ id: 'human-nomad-v1', list: path.join(here, 'human-nomad-v1', 'ship-assets.json') }];

export default async function prepare({ assetsSrcDir }) {
  for (const ship of SHIPS) {
    const { assets } = JSON.parse(readFileSync(ship.list, 'utf8'));
    for (const a of assets) {
      const src = path.join(assetsSrcDir, a.deliveryPath);
      if (!existsSync(src)) throw new Error(`prepare-assets: ${a.deliveryPath} missing from the fetched zip`);
      const sha = createHash('sha256').update(readFileSync(src)).digest('hex');
      if (sha !== a.sha256) throw new Error(`prepare-assets: ${a.deliveryPath} SHA-256 ${sha} does not match approved ${a.sha256}`);
      copyFileSync(src, path.join(assetsSrcDir, 'loose', `${ship.id}-${a.asset}.png`));
    }
    console.log(`prepare-assets: ${ship.id}: ${assets.length} approved parts verified and staged`);
  }

  // Terrain: generated from the handoff's own SVG definitions, then checked against its manifest.
  const loose = path.join(assetsSrcDir, 'loose');
  await buildTerrain(loose);
  const terrain = JSON.parse(readFileSync(path.join(here, 'terrain-v09', 'terrain-assets.json'), 'utf8'));
  for (const a of terrain.assets) {
    const sha = createHash('sha256').update(readFileSync(path.join(loose, a.file))).digest('hex');
    if (sha !== a.sha256) throw new Error(`prepare-assets: terrain ${a.file} SHA-256 ${sha} does not match the handoff manifest ${a.sha256}`);
  }
  console.log(`prepare-assets: terrain-v09: ${terrain.assets.length} generated assets match the handoff manifest`);
}
