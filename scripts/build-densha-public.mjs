// Standalone static release of the permanent sushi branch. Art stays outside Git.
import path from 'node:path';import fs from 'node:fs';import {fileURLToPath} from 'node:url';import {build} from 'vite';import {generateVersionStamps} from './generate-versions.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),requested=process.argv[2]??'dist/densha-sushi',out=path.resolve(root,requested),dist=path.join(root,'dist');
if(out!==dist&&!out.startsWith(dist+path.sep))throw Error('Public output must stay inside this checkout\'s dist directory');
const publicDir=path.join(root,'public/prototypes/densha-domino');
const manifest=JSON.parse(fs.readFileSync(path.join(publicDir,'assets/manifest.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'prototypes/densha-domino/art-sets.json'),'utf8'));
for(const file of new Set([...Object.values(catalog.shared),...Object.values(catalog.sets).flatMap(set=>Object.values(set))])){
  if(!manifest.some(entry=>entry.path===file))throw Error('Missing art-set asset: '+file);
}
generateVersionStamps(root);
await build({configFile:false,root:path.join(root,'prototypes/densha-domino'),base:'./',publicDir,build:{outDir:out,emptyOutDir:true}});
console.log('Standalone sushi game ready: '+out);

