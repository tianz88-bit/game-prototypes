import { EDITIONS, editionContract, editionTune } from './scripts/punchies-editions.mjs';
import { defineConfig } from 'vite';
import { punchiesDebugGate } from './scripts/punchies-debug-gate';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { generateVersionStamps } from './scripts/generate-versions.js';
import { packTuneMetadata, packLocale, packArtIndex } from './scripts/punchies-json-packing';

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

function getPrototypeEntries(): Record<string, string> {
  if (process.env.PUNCHIES_ASSET_PROFILE) return {
    punchies: path.resolve(__dirname, 'prototypes/punchies/index.html'),
    ...(process.env.PUNCHIES_STAGING === 'on' && process.env.PUNCHIES_QA === '1' && process.env.PUNCHIES_STAGING_QA === '1' ? {
      stagingReview: path.resolve(__dirname, 'prototypes/punchies/staging-review.html'),
      ...(fs.existsSync(path.resolve(__dirname,'prototypes/punchies/ranked-review.html'))?{rankedReview:path.resolve(__dirname,'prototypes/punchies/ranked-review.html')}: {}),
    } : {}),
  };
  const entries: Record<string, string> = {
    main: path.resolve(__dirname, 'index.html'),
  };
  const protoDir = path.resolve(__dirname, 'prototypes');
  if (!fs.existsSync(protoDir)) return entries;
  for (const name of fs.readdirSync(protoDir)) {
    const htmlPath = path.join(protoDir, name, 'index.html');
    if (fs.existsSync(htmlPath)) {
      entries[name] = htmlPath;
    }
  }
  // Studies are built onto the Pages site too; only ones the owner asked to publish are linked from the hub.
  const studyDir = path.resolve(__dirname, 'studies');
  if (fs.existsSync(studyDir)) {
    for (const name of fs.readdirSync(studyDir)) {
      const htmlPath = path.join(studyDir, name, 'index.html');
      if (fs.existsSync(htmlPath)) entries[`study-${name}`] = htmlPath;
    }
  }
  return entries;
}

generateVersionStamps(__dirname);
const assetProfile = process.env.PUNCHIES_ASSET_PROFILE;
const edition=editionContract(process.env.PUNCHIES_EDITION??EDITIONS.defaultEdition);
if(edition.name==='crazygames'&&(process.env.PORTAL??'web')!=='crazygames')throw Error('CrazyGames edition requires CrazyGames portal');
const stagingBuild=process.env.PUNCHIES_STAGING==='on';
const qaBuild=process.env.PUNCHIES_QA==='1';
const saveResetId=process.env.PUNCHIES_SAVE_RESET_ID??'';
if(saveResetId&&!['web',...(edition.name==='crazygames'?['crazygames']:[])].includes(process.env.PORTAL??'web'))throw new Error('The save reset is authorized for web/itch and staging builds only');
if (assetProfile) {
  if (!['standard', 'compact'].includes(assetProfile) || !process.env.PUNCHIES_PUBLIC_DIR) throw new Error('Use the Punchies profile build scripts to prepare isolated assets');
  const record = JSON.parse(fs.readFileSync(path.join(process.env.PUNCHIES_PUBLIC_DIR, 'prototypes/punchies/asset-profile.json'), 'utf8'));
  if (record.profile !== assetProfile || record.portal !== (process.env.PORTAL ?? 'web') || (record.edition??'master') !== edition.name) throw new Error('Staged assets do not match the requested profile/portal');
}

// Optional packed art index: generated from the R2 source folders by the
// packer. An art-free checkout boots the existing procedural fallback.
function punchiesArtIndex(): unknown {
  const dir = path.resolve(process.env.PUNCHIES_PUBLIC_DIR ?? path.join(__dirname, 'public'), 'prototypes/punchies/assets');
  const read = (file: string, fallback: unknown) => fs.existsSync(path.join(dir, file))
    ? JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) : fallback;
  return { manifest: read('manifest.json', []), animations: read('atlas/animations.json', {}), groups: read('atlas/groups.json', {}) };
}

export default defineConfig(({ command }) => ({
  root: assetProfile ? path.resolve(__dirname, 'prototypes/punchies') : __dirname,
  base: '/game-prototypes/',
  publicDir: process.env.PUNCHIES_PUBLIC_DIR ?? 'public',
    plugins: [punchiesDebugGate(stagingBuild, qaBuild), react(), tailwindcss(), {
      name: 'punchies-art-index', enforce:'pre', apply:'build',
      transformIndexHtml(html,ctx){if(ctx.filename.replace(/\\/g,'/').endsWith('/prototypes/punchies/index.html'))return html.replace(/<title>.*?<\/title>/,'<title>'+ (edition.name==='crazygames'?'Punchies CrazyGames':edition.name==='itchbeta'?'Punchies Beta':'Punchies Master')+'</title>');},
      resolveId(id) { if(id==='virtual:punchies-art')return '\0punchies-art'; },
      load(id) { if(id==='\0punchies-art')return `export default ${packArtIndex(punchiesArtIndex() as Parameters<typeof packArtIndex>[0])};`; },
      transform(code,id) {
        if(id.replace(/\\/g,'/').endsWith('/prototypes/punchies/src/render/art.ts'))return {code:"import packedArt from 'virtual:punchies-art';\n"+code.replace('const index = __PUNCHIES_ART__;', 'const index: ArtIndex = packedArt;'),map:null};
      },
    }, {
    name: 'punchies-packed-json',
    enforce: 'post',
    apply: 'build',
    transform(_code, id) {
      const file = id.replace(/\\/g, '/');
      if (assetProfile && file.endsWith('/prototypes/punchies/tune.json')) {
        // Standalone game packages do not include the workshop/editor. Preserve
        // its history in tune.json and the normal hub/tuner build, not in gameplay.
        const values = edition.name==='master'?JSON.parse(fs.readFileSync(id, 'utf8')):editionTune(JSON.parse(fs.readFileSync(id, 'utf8')),edition.name);
        delete values.balanceWorkshop;
        return { code: `export default ${JSON.stringify(values)};`, map: null };
      }
      if (file.endsWith('/prototypes/punchies/tune.meta.json')) return { code: packTuneMetadata(JSON.parse(fs.readFileSync(id, 'utf8'))), map: null };
      if (/\/prototypes\/punchies\/src\/i18n\/locales\/(ja|ko|zh|es|ar)\.json$/.test(file)) {
        const en = JSON.parse(fs.readFileSync(path.join(path.dirname(id), 'en.json'), 'utf8'));
        return { code: packLocale(en, JSON.parse(fs.readFileSync(id, 'utf8'))), map: null };
      }
    },
  }],
  define: {
    __GIT_SHA__: JSON.stringify(getGitSha()),
    __PUNCHIES_EDITION__:JSON.stringify(edition.name),
    __PUNCHIES_EDITION_FIGHTERS__:JSON.stringify(edition.fighters),
    __PUNCHIES_EDITION_POLICY_HASH__:JSON.stringify(edition.policyHash),
    __PUNCHIES_EDITION_NAMESPACE__:JSON.stringify(edition.storageNamespace),
    __PUNCHIES_STAGING__:JSON.stringify(stagingBuild),
    __PUNCHIES_SOURCE_SHA__:JSON.stringify(execSync('git rev-parse HEAD').toString().trim()),
    __PUNCHIES_QA__:JSON.stringify(qaBuild),
    __PUNCHIES_SAVE_RESET_ID__:JSON.stringify(saveResetId),
    __PUNCHIES_STAGING_QA__: JSON.stringify(process.env.PUNCHIES_STAGING_QA === '1'),
      __PUNCHIES_ART__: JSON.stringify(punchiesArtIndex()),
    __PUNCHIES_PORTAL__: JSON.stringify(process.env.PORTAL ?? 'web'),
    __PUNCHIES_MUSIC_EXTENSION__: JSON.stringify(process.env.PUNCHIES_ASSET_PROFILE === 'compact' ? 'm4a' : 'mp3'),
    __PUNCHIES_PORTAL_ADS__: JSON.stringify((process.env.PORTAL??'web')==='crazygames'&&process.env.PORTAL_ADS !== 'off'),
    // PORTAL_FIXED_ALIAS=on: a portal that forbids user-generated text gets generated or platform names only.
    __PUNCHIES_FIXED_ALIAS__: JSON.stringify(process.env.PORTAL_FIXED_ALIAS === 'on'),
    __PUNCHIES_ASSET_BASE__: JSON.stringify(assetProfile ? './' : command === 'serve' ? '/game-prototypes/' : '../../'),
  },
  build: {
    rollupOptions: {
      input: getPrototypeEntries(),
    },
  },
}));

