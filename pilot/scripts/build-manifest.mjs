import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const entries=files(root).filter(p=>!p.endsWith('build-manifest.json')&&!p.includes('/analysis/derived/')).sort().map(p=>({path:path.relative(root,p),bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
const id=crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
fs.writeFileSync(path.join(root,'build-manifest.json'),JSON.stringify({build_id:id,generated_at:new Date().toISOString(),files:entries},null,2)+'\n');
console.log(`Manifest ${id}: ${entries.length} files`);
