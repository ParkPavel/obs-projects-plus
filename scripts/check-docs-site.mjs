import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readRepoFile } from './site/paths.mjs';
import { languages } from './site/content.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const docs=path.join(root,'docs');
const security=spawnSync(process.execPath,['--test',path.join(root,'scripts/site/paths.test.mjs')],{cwd:root,encoding:'utf8'});
if(security.status!==0){process.stderr.write(security.stderr||security.stdout||'Site path security checks failed.');process.exit(1);}
const generated=spawnSync(process.execPath,[path.join(root,'scripts/build-docs-site.mjs'),'--check'],{cwd:root,encoding:'utf8'});
if(generated.status!==0){process.stderr.write(generated.stderr||generated.stdout);process.exit(1);}
const manifest=JSON.parse(await fs.readFile(path.join(docs,'site-manifest.json'),'utf8'));
const problems=[];
if(manifest.files.filter(f=>f.name.endsWith('.html')).length!==manifest.sources.length+Object.keys(languages).length)problems.push('A source document is missing its own page.');
for(const {name} of manifest.files.filter(f=>f.name.endsWith('.html'))){
  const file=path.join(docs,name),html=await fs.readFile(file,'utf8');
  if(!/<html lang="(?:ru|en)">/.test(html))problems.push(`${name}: missing language`);
  if(!html.includes('name="viewport"'))problems.push(`${name}: missing viewport`);
  if(!html.includes('id="main"'))problems.push(`${name}: missing main landmark`);
  if(!html.includes('<title>'))problems.push(`${name}: missing title`);
  if(/<script[^>]*>\s*[^<\s]/.test(html))problems.push(`${name}: inline script`);
  for(const match of html.matchAll(/\b(?:href|src)="([^"]*)"/g)){
    const raw=match[1].replaceAll('&amp;','&');
    if(/^(?:https?:|mailto:|data:)/i.test(raw))continue;
    const [relative,fragment]=raw.split('#');
    let target=relative?path.resolve(path.dirname(file),decodeURIComponent(relative)):file;
    if(target===docs)target=path.join(docs,'index.html');
    if(target!==docs&&!target.startsWith(docs+path.sep)){problems.push(`${name}: link escapes docs: ${raw}`);continue;}
    const bytes=await readRepoFile(docs,path.relative(docs,target).split(path.sep).join('/')).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(!bytes){problems.push(`${name}: missing ${raw}`);continue;}
    if(fragment&&target.endsWith('.html')){
      const id=decodeURIComponent(fragment);
      if(!bytes.toString('utf8').includes(`id="${id}"`))problems.push(`${name}: missing anchor ${raw}`);
    }
  }
  for(const match of html.matchAll(/<img\b[^>]*>/g))if(!/\balt="[^"]+"/.test(match[0]))problems.push(`${name}: image has no alternative text`);
}
const search=JSON.parse(await fs.readFile(path.join(docs,'search-index.json'),'utf8'));
for(const language of ['ru','en'])if(!search.some(e=>e.lang===language&&e.text.length>100))problems.push(`search index missing ${language}`);
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}
else console.log(`Site PASS: ${manifest.files.filter(f=>f.name.endsWith('.html')).length} pages, local links, anchors, assets, both search languages.`);
