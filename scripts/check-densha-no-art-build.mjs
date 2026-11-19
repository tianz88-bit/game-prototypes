// Separate production build with an empty public asset directory; approved art stays untouched.
import fs from 'node:fs';
import path from 'node:path';
import {build} from 'vite';
const root=process.cwd(),empty=path.resolve(root,'.cache/densha-empty-public'),out=path.resolve(root,'.cache/densha-no-art-dist');
if(!empty.startsWith(root+path.sep)||!out.startsWith(root+path.sep))throw Error('Build paths must remain in this checkout');
fs.mkdirSync(empty,{recursive:true});
if(fs.readdirSync(empty).length)throw Error('Expected an empty public directory');
await build({publicDir:empty,build:{outDir:out}});
if(fs.existsSync(path.join(out,'prototypes/densha-domino/assets/manifest.json')))throw Error('No-art output unexpectedly contains artwork');
console.log('PASS: production build succeeds with no Densha art files. Prepared local art remains unchanged.');
