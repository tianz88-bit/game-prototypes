// pack-assets hook (see scripts/pack-assets.js): runs after the R2 fetch, before loose/ is copied.
// The Human Nomad delivery zip nests its parts under loose/ships/human-nomad/scrappy-v1/; pack-assets
// copies only files directly in loose/. Copy each approved part byte-for-byte to loose/<ship>-<asset>.png,
// refusing any file whose SHA-256 differs from the approved kit manifest. Pixels are never changed here.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import buildTerrain from './terrain-v09/build-terrain.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIPS = [{ id: 'human-nomad-v1', list: path.join(here, 'human-nomad-v1', 'ship-assets.json') }];

// Ships v2 (owner art, 14 November 2026): each ship has its own R2 zip. The shared fetch script
// extracts one zip per prototype, so these are fetched here: zip and every part checked against the
// committed manifest (art/<ship>/ship-assets.json), then staged as loose/<ship>-<asset>.png.
// Downloads are cached by content hash in .cache/, never by name.
const EXTRA_SHIPS = [
  { id: 'human-nomad-sparrow-v1', list: path.join(here, 'sparrow-v1', 'ship-assets.json') },
  { id: 'human-nomad-bat-v3', list: path.join(here, 'bat-v3', 'ship-assets.json') },
  { id: 'human-nomad-battlecruiser-v3', list: path.join(here, 'battlecruiser-v3', 'ship-assets.json') },
];

async function stageExtraShips(assetsSrcDir) {
  const cache = path.join(here, '..', '..', '..', '.cache');
  mkdirSync(cache, { recursive: true });
  for (const ship of EXTRA_SHIPS) {
    const m = JSON.parse(readFileSync(ship.list, 'utf8'));
    const cached = path.join(cache, `${m.zipSha256}.zip`);
    let bytes = existsSync(cached) ? readFileSync(cached) : null;
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== m.zipSha256) {
      const r = await fetch(m.url);
      if (!r.ok) throw new Error(`prepare-assets: ${m.r2Object} HTTP ${r.status}`);
      bytes = Buffer.from(await r.arrayBuffer());
      const sha = createHash('sha256').update(bytes).digest('hex');
      if (sha !== m.zipSha256) throw new Error(`prepare-assets: ${m.r2Object} SHA-256 ${sha} does not match ${m.zipSha256}`);
      writeFileSync(cached, bytes);
    }
    const zip = new AdmZip(bytes);
    for (const a of m.assets) {
      const e = zip.getEntry(a.deliveryPath);
      if (!e) throw new Error(`prepare-assets: ${a.deliveryPath} missing from ${m.r2Object}`);
      const data = e.getData();
      const sha = createHash('sha256').update(data).digest('hex');
      if (sha !== a.sha256) throw new Error(`prepare-assets: ${a.deliveryPath} SHA-256 ${sha} does not match ${a.sha256}`);
      writeFileSync(path.join(assetsSrcDir, 'loose', `${ship.id}-${a.asset}.png`), data);
    }
    console.log(`prepare-assets: ${ship.id}: ${m.assets.length} parts verified and staged`);
  }
}

/** Painted asteroids (owner art): 3 colour families x parent + 2 medium + 2 small, from the visual pack. */
async function stageAsteroids(assetsSrcDir) {
  for(const list of ['asteroids-v1/asteroid-assets.json','rich-asteroids-v1/assets.json']) {
  const m = JSON.parse(readFileSync(path.join(here,list), 'utf8'));
  const zip = new AdmZip(await fetchVerified(m));
  for (const a of m.assets) {
    const e = zip.getEntry(a.deliveryPath);
    if (!e) throw new Error(`prepare-assets: ${a.deliveryPath} missing from ${m.r2Object}`);
    const data = e.getData();
    const sha = createHash('sha256').update(data).digest('hex');
    if (sha !== a.sha256) throw new Error(`prepare-assets: ${a.deliveryPath} SHA-256 ${sha} does not match ${a.sha256}`);
    writeFileSync(path.join(assetsSrcDir, 'loose', `asteroid-${a.name}.png`), data);
  }
  console.log(`prepare-assets: ${list}: ${m.assets.length} painted rocks verified and staged`);
  }
}

/** Download an R2 zip (cached by its SHA-256 in .cache/) and check the hash. */
async function fetchVerified(m) {
  const cache = path.join(here, '..', '..', '..', '.cache');
  mkdirSync(cache, { recursive: true });
  const cached = path.join(cache, `${m.zipSha256}.zip`);
  let bytes = existsSync(cached) ? readFileSync(cached) : null;
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== m.zipSha256) {
    if(m.status==='local-review-only')throw new Error(`Preview pack ${m.r2Object} needs its local hash-verified ZIP in .cache; owner approval and R2 upload are pending.`);
    const r = await fetch(m.url);
    if (!r.ok) throw new Error(`prepare-assets: ${m.r2Object} HTTP ${r.status}`);
    bytes = Buffer.from(await r.arrayBuffer());
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (sha !== m.zipSha256) throw new Error(`prepare-assets: ${m.r2Object} SHA-256 ${sha} does not match ${m.zipSha256}`);
    writeFileSync(cached, bytes);
  }
  return bytes;
}

export default async function prepare({ assetsSrcDir }) {
  await stageExtraShips(assetsSrcDir);
  await stageAsteroids(assetsSrcDir);
  // Preserve original PNGs in the delivery ZIP; only runtime copies are resolution-bounded.
  for (const pack of ['combat-title-v1','combat-backlog-v1','buildings-v1','warzone-v1']) {
  const combat = JSON.parse(readFileSync(path.join(here,pack,'assets.json'),'utf8'));
  const combatZip = new AdmZip(await fetchVerified(combat));
  for (const a of combat.assets) {
    const entry = combatZip.getEntry(a.deliveryPath);
    if (!entry) throw new Error(`prepare-assets: missing ${a.deliveryPath}`);
    const source = entry.getData();
    if (createHash('sha256').update(source).digest('hex') !== a.sha256) throw new Error(`prepare-assets: ${a.name} hash mismatch`);
    await sharp(source).resize({width:a.runtimeMax,height:a.runtimeMax,fit:'inside',withoutEnlargement:true}).png()
      .toFile(path.join(assetsSrcDir,'loose',`${pack==='buildings-v1'||pack==='warzone-v1'?'building':'combat'}-${a.name}.png`));
  }
  console.log(`prepare-assets: ${pack}: ${combat.assets.length} sources verified and runtime copies staged`);
  }
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
